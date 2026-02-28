#!/usr/bin/swift
// pdf_to_images.swift - 将 PDF 每页渲染为 PNG
// 用法: swift pdf_to_images.swift <pdf_path> <output_dir> [max_pages]

import Foundation
import CoreGraphics
#if canImport(AppKit)
import AppKit
#endif

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("用法: swift pdf_to_images.swift <pdf_path> <output_dir> [max_pages]")
    exit(1)
}

let pdfPath = args[1]
let outputDir = args[2]
let maxPages = args.count > 3 ? Int(args[3]) ?? 15 : 15

// 创建输出目录
try? FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

guard let pdfURL = URL(string: "file://" + pdfPath.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)!),
      let pdf = CGPDFDocument(pdfURL as CFURL) else {
    print("ERROR: 无法打开 PDF 文件: \(pdfPath)")
    exit(1)
}

let pageCount = pdf.numberOfPages
print("共 \(pageCount) 页")
let processPages = min(pageCount, maxPages)

for pageNum in 1...processPages {
    guard let page = pdf.page(at: pageNum) else {
        print("警告: 第 \(pageNum) 页无法获取")
        continue
    }
    
    let scale: CGFloat = 2.0
    let rect = page.getBoxRect(.cropBox)
    let width = Int(rect.width * scale)
    let height = Int(rect.height * scale)
    
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        print("错误: 第 \(pageNum) 页无法创建绘图上下文")
        continue
    }
    
    // 白色背景
    context.setFillColor(red: 1, green: 1, blue: 1, alpha: 1)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    
    context.scaleBy(x: scale, y: scale)
    context.drawPDFPage(page)
    
    guard let image = context.makeImage() else {
        print("错误: 第 \(pageNum) 页无法生成图片")
        continue
    }
    
    let outputPath = "\(outputDir)/page_\(pageNum).png"
    let outputURL = URL(fileURLWithPath: outputPath)
    
    guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, "public.png" as CFString, 1, nil) else {
        print("错误: 无法创建输出文件 \(outputPath)")
        continue
    }
    
    CGImageDestinationAddImage(destination, image, nil)
    if CGImageDestinationFinalize(destination) {
        let attrs = try? FileManager.default.attributesOfItem(atPath: outputPath)
        let size = attrs?[.size] as? Int ?? 0
        print("页面 \(pageNum): 已保存 \(outputPath) (\(size) bytes)")
    } else {
        print("错误: 第 \(pageNum) 页写入失败")
    }
}

print("完成!")
