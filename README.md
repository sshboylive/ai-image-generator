# AI图像生成器

基于Stable Diffusion XL模型的AI图像生成工具，可以通过文字描述生成高质量图像。

## 在线使用

访问：[https://sshboylive.github.io/ai-image-generator](https://sshboylive.github.io/ai-image-generator)

## 使用方法

1. 获取Hugging Face API密钥（在[这里](https://huggingface.co/settings/tokens)申请）
2. 在应用中输入您的API密钥
3. 选择一个AI模型（推荐使用Stable Diffusion XL获得最佳效果）
4. 输入详细的图像描述
5. 可选：设置反向提示词和调整高级参数
6. 点击"生成图像"按钮

## 功能特点

- 支持多种Stable Diffusion模型
- 可调整图像尺寸、推理步数、引导比例等参数
- 支持种子值设置，可以复现特定图像
- 移动端友好的响应式设计

## 技术栈

- React
- Tailwind CSS
- Hugging Face API

## 本地运行

这是一个纯前端项目，不需要安装Node.js或其他依赖。只需要：

1. 克隆仓库
```bash
git clone https://github.com/sshboylive/ai-image-generator.git