import { PDFDocument } from 'pdf-lib'

/**
 * 将三份 PDF 文件合并为一份
 *    另外三个参数的类型都是 Buffer，是表示 PDF 文件加载到内存后二进制内容
 * @param { Buffer } coverBuffer 封面 PDF
 * @param { Buffer } contentBuffer 内容页 PDF
 * @param { Buffer } lastPageBuffer 尾页 PDF
 * @returns 合并后的 PDF 文件的二进制内容
 */
export default async function mergePDF(coverBuffer, contentBuffer, lastPageBuffer) {
  // 通过 pdf-lib 加载现有的 3份 PDF 文档
  const { load } = PDFDocument
  const [coverPdfDoc, contentPdfDoc, lastPagePdfDoc] = await Promise.all([load(coverBuffer), load(contentBuffer), load(lastPageBuffer)])
  // 分别将封面文档和尾页文档的第一页拷贝到内容文档
  const [[coverPage], [lastPagePage]] = await Promise.all([contentPdfDoc.copyPages(coverPdfDoc, [0]), contentPdfDoc.copyPages(lastPagePdfDoc, [0])])
  // 将封面页插入到 内容文档 的第 0 页，即最开始的位置
  contentPdfDoc.insertPage(0, coverPage)
  // 将尾页添加到 内容文档 的最后一页
  contentPdfDoc.addPage(lastPagePage)
  // 将合并后的 内容文档 序列化为字节数组（Uint8Array），并以二进制的格式返回
  return Buffer.from(await contentPdfDoc.save())
}