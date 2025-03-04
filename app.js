// 使用React和ReactDOM
const { useState, useEffect } = React;

// 定义App组件
function App() {
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState(''); 
    const [generatedImage, setGeneratedImage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [numInferenceSteps, setNumInferenceSteps] = useState(30);
    const [guidanceScale, setGuidanceScale] = useState(7.5);
    const [width, setWidth] = useState(512);
    const [height, setHeight] = useState(512);
    const [seed, setSeed] = useState(-1);
    const [lastUsedSeed, setLastUsedSeed] = useState(null);

    // 获取可用模型列表
    useEffect(() => {
        fetchModels();
    }, []);

    // 获取模型列表
    const fetchModels = async () => {
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            
            const allModels = [
                ...(data.onlineModels || []), 
                ...(data.localModels || [])
            ];
            setModels(allModels);
            
            // 默认选择第一个模型
            if (allModels.length > 0) {
                setSelectedModel(allModels[0]);
            }
        } catch (err) {
            console.error('获取模型列表失败:', err);
            setError('获取模型列表失败，请检查网络连接或刷新页面重试');
        }
    };

    // 生成图像函数
    const generateImage = async () => {
        if (!prompt.trim()) {
            setError('请输入描述文本');
            return;
        }
    
        if (!selectedModel) {
            setError('请选择一个模型');
            return;
        }
    
        setIsLoading(true);
        setError('');
    
        // 如果用户选择了随机种子（-1），则每次生成都使用新的随机种子
        let currentSeed = seed;
        if (seed === -1) {
            // 确保每次生成都使用新的随机种子
            currentSeed = Math.floor(Math.random() * 2147483647);
            console.log('使用新的随机种子:', currentSeed);
        }
    
        try {
            // 添加重试逻辑
            let retries = 0;
            const maxRetries = 2;
            let success = false;
            let responseData;
            
            while (retries <= maxRetries && !success) {
                try {
                    const response = await fetch('/api/generate-image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            prompt,
                            negativePrompt,
                            model: selectedModel,
                            useLocalModel: selectedModel.type === 'local',
                            parameters: {
                                num_inference_steps: numInferenceSteps,
                                guidance_scale: guidanceScale,
                                width: width,
                                height: height,
                                seed: currentSeed
                            }
                        }),
                    });
    
                    if (!response.ok) {
                        const errorData = await response.json();
                        if (response.status === 503 && retries < maxRetries) {
                            // 服务暂时不可用，尝试重试
                            retries++;
                            await new Promise(resolve => setTimeout(resolve, 2000 * retries));
                            continue;
                        }
                        throw new Error(errorData.error || `服务器错误 (${response.status})`);
                    }
    
                    responseData = await response.json();
                    success = true;
                } catch (err) {
                    if (retries >= maxRetries) {
                        throw err;
                    }
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 2000 * retries));
                }
            }
    
            if (success && responseData) {
                setGeneratedImage(responseData.imageUrl);
                
                // 在生成结果中显示使用的种子值
                if (responseData.seed) {
                    // 如果服务器返回了使用的种子值，更新UI显示
                    setLastUsedSeed(responseData.seed);
                } else {
                    // 否则使用我们生成的种子值
                    setLastUsedSeed(currentSeed);
                }
            }
        } catch (err) {
            console.error('生成图像错误:', err);
            if (err.message.includes('503')) {
                setError('Hugging Face API 服务暂时不可用，请稍后再试。您也可以尝试使用其他模型。');
            } else {
                setError(err.message || '生成图像时出错');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // 随机种子函数
    const randomizeSeed = () => {
        setSeed(-1);
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <header className="text-center mb-12">
                <h1 className="text-4xl font-bold text-indigo-700">AI图像生成器</h1>
                <p className="text-gray-600 mt-2">输入文字描述，AI将为您生成相应的图像</p>
            </header>
    
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6">
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                        选择模型
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedModel ? selectedModel.id : ''}
                        onChange={(e) => {
                            const model = models.find(m => m.id === e.target.value);
                            setSelectedModel(model || null);
                        }}
                    >
                        <option value="">选择模型</option>
                        {models.map(model => (
                            <option key={model.id} value={model.id}>
                                {model.name} ({model.type})
                            </option>
                        ))}
                    </select>
                </div>
    
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                        描述您想要的图像
                    </label>
                    <textarea
                        id="prompt"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows="3"
                        placeholder="例如：一只在草地上奔跑的金毛犬，阳光明媚"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    ></textarea>
                </div>
    
                {/* 添加反向提示词输入框 */}
                <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                        反向提示词（不希望出现的元素）
                    </label>
                    <textarea
                        id="negativePrompt"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows="2"
                        placeholder="例如：模糊，变形，低质量，像素化，低分辨率，不完整"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                    ></textarea>
                    <p className="text-xs text-gray-500 mt-1">指定您不希望在生成图像中出现的元素</p>
                </div>
    
                {/* 添加高级参数设置 */}
                <div className="mb-6">
                    <button
                        type="button"
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        {showAdvanced ? '隐藏高级设置' : '显示高级设置'}
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={showAdvanced ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}></path>
                        </svg>
                    </button>
                    
                    {showAdvanced && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-md">
                            <h3 className="text-lg font-medium text-gray-700 mb-3">高级参数设置</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        推理步数 ({numInferenceSteps})
                                    </label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={numInferenceSteps}
                                        onChange={(e) => setNumInferenceSteps(parseInt(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>10</span>
                                        <span>100</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        引导比例 ({guidanceScale.toFixed(1)})
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        step="0.1"
                                        value={guidanceScale}
                                        onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>1.0</span>
                                        <span>20.0</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        宽度 ({width}px)
                                    </label>
                                    <select
                                        value={width}
                                        onChange={(e) => setWidth(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="256">256px</option>
                                        <option value="512">512px</option>
                                        <option value="768">768px</option>
                                        <option value="1024">1024px</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        高度 ({height}px)
                                    </label>
                                    <select
                                        value={height}
                                        onChange={(e) => setHeight(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="256">256px</option>
                                        <option value="512">512px</option>
                                        <option value="768">768px</option>
                                        <option value="1024">1024px</option>
                                    </select>
                                </div>
                                
                                {/* 添加随机种子输入框 */}
                                <div className="md:col-span-2">
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        随机种子
                                    </label>
                                    <div className="flex">
                                        <input
                                            type="number"
                                            value={seed === -1 ? '' : seed}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? -1 : parseInt(e.target.value);
                                                setSeed(val);
                                            }}
                                            placeholder="随机"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={randomizeSeed}
                                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-r-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            随机
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">输入-1表示每次生成使用随机种子</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* 添加生成按钮 */}
                <div className="mb-6">
                    <button
                        type="button"
                        onClick={generateImage}
                        disabled={isLoading}
                        className={`w-full py-3 px-4 rounded-md text-white font-medium ${
                            isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
```

// 渲染应用到DOM
ReactDOM.render(<App />, document.getElementById('root'));