import argparse
import os
import sys
from PIL import Image

def main():
    parser = argparse.ArgumentParser(description="使用本地模型生成图像")
    parser.add_argument("--prompt", type=str, required=True, help="文本提示词")
    parser.add_argument("--negative_prompt", type=str, default="", help="反向提示词")
    parser.add_argument("--model_path", type=str, required=True, help="模型路径")
    parser.add_argument("--output", type=str, required=True, help="输出图像路径")
    parser.add_argument("--steps", type=int, default=30, help="推理步数")
    parser.add_argument("--guidance_scale", type=float, default=7.5, help="引导比例")
    parser.add_argument("--width", type=int, default=512, help="图像宽度")
    parser.add_argument("--height", type=int, default=512, help="图像高度")
    parser.add_argument("--seed", type=int, default=None, help="随机种子")
    
    args = parser.parse_args()
    
    try:
        print(f"使用模型: {args.model_path}")
        print(f"提示词: {args.prompt}")
        if args.negative_prompt:
            print(f"反向提示词: {args.negative_prompt}")
        
        # 尝试导入必要的库
        try:
            import torch
            from diffusers import StableDiffusionPipeline
        except ImportError:
            print("错误: 缺少必要的库。请安装: pip install torch diffusers transformers")
            sys.exit(1)
        
        # 检查CUDA是否可用
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"使用设备: {device}")
        
        # 加载模型
        try:
            pipe = StableDiffusionPipeline.from_pretrained(args.model_path)
            pipe = pipe.to(device)
        except Exception as e:
            print(f"加载模型失败: {str(e)}")
            sys.exit(1)
        
        # 设置随机种子
        generator = None
        if args.seed is not None:
            generator = torch.Generator(device).manual_seed(args.seed)
            print(f"使用种子: {args.seed}")
        else:
            # 如果没有提供种子，则生成一个随机种子
            import random
            random_seed = random.randint(0, 2147483647)
            generator = torch.Generator(device).manual_seed(random_seed)
            print(f"使用随机种子: {random_seed}")
        
        # 生成图像
        try:
            with torch.no_grad():
                image = pipe(
                    prompt=args.prompt,
                    negative_prompt=args.negative_prompt,
                    width=args.width,
                    height=args.height,
                    num_inference_steps=args.steps,
                    guidance_scale=args.guidance_scale,
                    generator=generator
                ).images[0]
        except Exception as e:
            print(f"生成图像失败: {str(e)}")
            sys.exit(1)
        
        # 保存图像
        try:
            image.save(args.output)
            print(f"图像已保存到: {args.output}")
        except Exception as e:
            print(f"保存图像失败: {str(e)}")
            sys.exit(1)
            
    except Exception as e:
        print(f"发生错误: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()