#!/usr/bin/env python3
# 从图片型PDF中提取嵌入的JPEG图片，然后调用GLM-4V识别文字
# 用法：python3 extract_pdf_images.py <pdf_path> <file_id>

import sys, os, re, json, base64, urllib.request, urllib.error

DATA_DIR = './data'
CONTENT_DIR = os.path.join(DATA_DIR, 'contents')
KB_FILE = os.path.join(DATA_DIR, 'knowledge_bases.json')
os.makedirs(CONTENT_DIR, exist_ok=True)

pdf_path = sys.argv[1] if len(sys.argv) > 1 else None
file_id  = sys.argv[2] if len(sys.argv) > 2 else None
if not pdf_path or not file_id:
    print("用法: python3 extract_pdf_images.py <pdf_path> <file_id>"); sys.exit(1)

def call_glm4v(img_b64, fmt, page_idx, total):
    mime = 'image/jpeg' if fmt == 'jpeg' else 'image/png'
    payload = json.dumps({
        'model': 'glm-4v-flash',
        'messages': [{'role': 'user', 'content': [
            {'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{img_b64}'}},
            {'type': 'text', 'text': f'这是PPT年终总结第{page_idx}张图（共{total}张）。请提取图中所有文字，包括标题、正文要点、数据。结构化输出，只输出内容本身。'}
        ]}],
        'temperature': 0.1, 'max_tokens': 1500
    }).encode()
    req = urllib.request.Request(
        'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 6eb4b8d348a84b9488aad8c7e3952baa.qEW8uP0etsZyKDKL'
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            return data['choices'][0]['message']['content']
    except Exception as e:
        return f'[识别失败: {e}]'

# 读取 PDF 二进制
with open(pdf_path, 'rb') as f:
    raw = f.read()

# 方法1：提取内嵌的 JPEG 图片
jpeg_images = []
pos = 0
while True:
    idx = raw.find(b'\xff\xd8\xff', pos)
    if idx == -1: break
    end = raw.find(b'\xff\xd9', idx)
    if end == -1: break
    jpeg_images.append(raw[idx:end+2])
    pos = end + 2

print(f'共找到 {len(jpeg_images)} 个JPEG图片对象')

all_text = ''
if jpeg_images:
    # 过滤太小的（< 10KB），可能是小图标
    valid = [(i, img) for i, img in enumerate(jpeg_images) if len(img) > 10000]
    print(f'有效图片（>10KB）: {len(valid)} 个')
    
    for page_idx, (orig_idx, img_bytes) in enumerate(valid[:15], 1):
        img_b64 = base64.b64encode(img_bytes).decode()
        print(f'\n[{page_idx}/{len(valid[:15])}] 识别第 {orig_idx+1} 个图片对象 ({len(img_bytes)//1024}KB)...')
        text = call_glm4v(img_b64, 'jpeg', page_idx, len(valid[:15]))
        print(f'  识别到 {len(text)} 字符: {text[:80].replace(chr(10), " ")}')
        all_text += f'\n===图片{page_idx}（原始第{orig_idx+1}个对象）===\n{text}\n'
        
        import time; time.sleep(0.5)  # 避免速率限制
else:
    # 如果没有 JPEG，尝试查找 PNG
    png_images = []
    pos = 0
    while True:
        idx = raw.find(b'\x89PNG\r\n\x1a\n', pos)
        if idx == -1: break
        # PNG 以 IEND 结尾
        iend = raw.find(b'IEND\xaeB`\x82', idx)
        if iend == -1: break
        png_images.append(raw[idx:iend+8])
        pos = iend + 8
    
    print(f'找到 {len(png_images)} 个PNG图片')
    valid = [(i, img) for i, img in enumerate(png_images) if len(img) > 10000]
    for page_idx, (orig_idx, img_bytes) in enumerate(valid[:15], 1):
        img_b64 = base64.b64encode(img_bytes).decode()
        print(f'[{page_idx}] 识别PNG图片 {orig_idx+1} ({len(img_bytes)//1024}KB)...')
        text = call_glm4v(img_b64, 'png', page_idx, len(valid[:15]))
        print(f'  {text[:80]}')
        all_text += f'\n===图片{page_idx}===\n{text}\n'

# 保存结果
if all_text.strip():
    out_path = os.path.join(CONTENT_DIR, f'{file_id}.txt')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(all_text.strip())
    print(f'\n✅ 保存完成，{len(all_text)} 字符 -> {out_path}')
    
    # 更新知识库文件状态
    with open(KB_FILE, encoding='utf-8') as f:
        kbs = json.load(f)
    for kb in kbs:
        for file in kb.get('files', []):
            if file['id'] == file_id:
                file['status'] = 'synced'
                print(f'✅ 文件 {file["name"]} 状态已更新')
    with open(KB_FILE, 'w', encoding='utf-8') as f:
        json.dump(kbs, f, ensure_ascii=False, indent=2)
else:
    print('\n❌ 未能提取到任何内容')
    all_text = f'[PDF文件"{os.path.basename(pdf_path)}"为图片型文档，无法提取文字内容。请尝试上传带有可复制文字的PDF版本，或上传.txt/.md格式的文档。]'
    out_path = os.path.join(CONTENT_DIR, f'{file_id}.txt')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(all_text)
