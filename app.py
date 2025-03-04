from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import sys
import torch
import random
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def generate_image():
    try:
        data = request.json
        
        # 获取参数
        prompt = data.get('prompt', '')
        negative_prompt = data.get('negative_prompt', '')
        model_path = data.get('model_path', '')
        steps = int(data.get('steps', 30))
        guidance_scale = float(data.get('guidance_scale', 7.5))
        width = int(data.get('width', 512))
        height = int(data.get('height', 512))
        seed = data.get('seed')
        
        if seed is not None and seed != -1:
            seed = int(seed)
        else:
            seed = random.randint(0, 2147483647)
        
        # 验证必要参数
        if not prompt or not model_path:
            return jsonify({'error': '缺少必要参数'}), 400
        
        # 检查CUDA是否可用
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        try:
            from diffusers import StableDiffusionPipeline
        except ImportError:
            return jsonify({'error': '缺少必要的库。请安装: pip install torch diffusers transformers'}), 500
        
        # 加载模型
        try:
            pipe = StableDiffusionPipeline.from_pretrained(model_path)
            pipe = pipe.to(device)
        except Exception as e:
            return jsonify({'error': f'加载模型失败: {str(e)}'}), 500
        
        # 设置随机种子
        generator = None
        if seed is not None:
            generator = torch.Generator(device).manual_seed(seed)
        
        # 生成图像
        try:
            with torch.no_grad():
                image = pipe(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    width=width,
                    height=height,
                    num_inference_steps=steps,
                    guidance_scale=guidance_scale,
                    generator=generator
                ).images[0]
        except Exception as e:
            return jsonify({'error': f'生成图像失败: {str(e)}'}), 500
        
        # 将图像转换为base64
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        return jsonify({
            'image': f'data:image/png;base64,{img_str}',
            'seed': seed
        })
        
    except Exception as e:
        return jsonify({'error': f'发生错误: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)