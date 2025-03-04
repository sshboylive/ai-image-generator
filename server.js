const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
require('dotenv').config();

// 添加未捕获异常处理
process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
});

const app = express();
const PORT = process.env.PORT || 3002; // 将端口改为3002

// 创建图片存储目录
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));  // 确保这一行存在
app.use('/images', express.static(path.join(__dirname, 'images')));

// API路由 - 生成图像
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, negativePrompt, model, useLocalModel, parameters } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: '缺少提示词参数' });
        }

        let imageBuffer;
        
        if (useLocalModel && model?.type === 'local') {
            // 使用本地模型生成图像
            try {
                console.log(`正在使用本地模型 ${model.name} 生成图像...`);
                console.log(`模型路径: ${model.path}`);
                console.log(`提示词: ${prompt}`);
                console.log(`参数:`, parameters);
                
                // 调用Python脚本生成图像，传递参数
                imageBuffer = await generateWithLocalModel(prompt, model.path, parameters);
            } catch (localError) {
                console.error('本地模型生成失败:', localError);
                return res.status(500).json({ 
                    error: '本地模型生成失败', 
                    details: localError.message 
                });
            }
        } else {
            // 使用Hugging Face API
            const modelId = model?.id || 'runwayml/stable-diffusion-v1-5';
            
            console.log(`正在使用在线模型 ${modelId} 生成图像...`);
            console.log(`提示词: ${prompt}`);
            console.log(`参数:`, parameters);
            
            try {
                // 设置API密钥
                process.env.HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || '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';
                
                // 构建API参数
                const apiParameters = {
                    num_inference_steps: parameters?.num_inference_steps || 30,
                    guidance_scale: parameters?.guidance_scale || 7.5,
                };
                
                // 添加宽度和高度参数（如果模型支持）
                if (parameters?.width && parameters?.height) {
                    apiParameters.width = parameters.width;
                    apiParameters.height = parameters.height;
                }
                
                // 添加种子参数（如果提供）
                if (parameters?.seed && parameters.seed !== -1) {
                    apiParameters.seed = parameters.seed;
                }
                
                const response = await axios({
                    url: `https://api-inference.huggingface.co/models/${modelId}`,
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify({
                        inputs: prompt,
                        parameters: apiParameters
                    }),
                    responseType: 'arraybuffer',
                    timeout: 120000, // 增加超时时间到120秒，因为更高的步数需要更长时间
                });
                
                imageBuffer = response.data;
            } catch (apiError) {
                console.error('API调用失败:', apiError.message);
                
                // 检查是否是503错误
                if (apiError.response && apiError.response.status === 503) {
                    return res.status(503).json({ 
                        error: 'Hugging Face API服务暂时不可用，请稍后再试',
                        details: '服务器繁忙或正在加载模型'
                    });
                }
                
                // 其他错误
                return res.status(apiError.response?.status || 500).json({ 
                    error: 'API调用失败', 
                    details: apiError.message 
                });
            }
        }
        
        // 保存图像到本地
        const imageId = uuidv4();
        const imagePath = path.join(imagesDir, `${imageId}.png`);
        fs.writeFileSync(imagePath, imageBuffer);

        // 返回图像URL和使用的种子值
        const imageUrl = `/images/${imageId}.png`;
        console.log(`图像已生成: ${imageUrl}`);
        res.json({ 
            imageUrl,
            seed: parameters?.seed || null  // 返回使用的种子值
        });
    } catch (error) {
        console.error('生成图像时出错:', error.message);
        res.status(500).json({ 
            error: '生成图像时出错', 
            details: error.message 
        });
    }
});

// 使用本地模型生成图像的函数
async function generateWithLocalModel(prompt, modelPath) {
    return new Promise((resolve, reject) => {
        // 创建临时输出文件路径
        const outputPath = path.join(imagesDir, `temp_${Date.now()}.png`);
        
        // 使用Python脚本调用本地模型
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'generate.py'),
            '--prompt', prompt,
            '--model_path', modelPath,
            '--output', outputPath
        ]);
        
        let errorData = '';
        
        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
            console.error(`Python错误: ${data}`);
        });
        
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Python进程退出，错误码 ${code}: ${errorData}`));
            }
            
            try {
                if (!fs.existsSync(outputPath)) {
                    return reject(new Error('生成的图像文件不存在'));
                }
                
                const imageBuffer = fs.readFileSync(outputPath);
                // 删除临时文件
                fs.unlinkSync(outputPath);
                resolve(imageBuffer);
            } catch (err) {
                reject(err);
            }
        });
    });
}

// 获取可用模型列表
app.get('/api/models', (req, res) => {
    try {
        // 从环境变量或配置中获取模型目录
        const modelsDir = process.env.MODELS_DIR || path.join(__dirname, 'models');
        
        let localModels = [];
        
        if (fs.existsSync(modelsDir)) {
            // 扫描本地模型目录
            localModels = fs.readdirSync(modelsDir)
                .filter(file => fs.statSync(path.join(modelsDir, file)).isDirectory())
                .map(dir => ({
                    id: dir,
                    name: dir,
                    path: path.join(modelsDir, dir),
                    type: 'local'
                }));
        }
            
        // 返回在线模型和本地模型
        res.json({
            onlineModels: [
                { id: 'runwayml/stable-diffusion-v1-5', name: 'Stable Diffusion v1.5', type: 'online' },
                { id: 'stabilityai/stable-diffusion-2-1', name: 'Stable Diffusion v2.1', type: 'online' },
                { id: 'CompVis/stable-diffusion-v1-4', name: 'Stable Diffusion v1.4', type: 'online' },
                { id: 'prompthero/openjourney', name: 'Openjourney', type: 'online' }
            ],
            localModels
        });
    } catch (error) {
        console.error('获取模型列表失败:', error);
        res.status(500).json({ error: '获取模型列表失败' });
    }
});

// 保存模型路径
app.post('/api/models/path', (req, res) => {
    try {
        const { path: modelPath } = req.body;
        
        if (!modelPath) {
            return res.status(400).json({ error: '模型路径不能为空' });
        }
        
        // 验证路径是否存在
        if (!fs.existsSync(modelPath)) {
            return res.status(400).json({ error: '指定的路径不存在' });
        }
        
        // 保存到环境变量
        process.env.MODELS_DIR = modelPath;
        
        // 也可以保存到配置文件中以便持久化
        const configPath = path.join(__dirname, 'config.json');
        const config = fs.existsSync(configPath) 
            ? JSON.parse(fs.readFileSync(configPath, 'utf8')) 
            : {};
            
        config.modelsDir = modelPath;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        res.json({ success: true, path: modelPath });
    } catch (error) {
        console.error('保存模型路径失败:', error);
        res.status(500).json({ error: '保存模型路径失败' });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});