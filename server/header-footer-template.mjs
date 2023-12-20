/**
 * 页眉页脚
 * 需要注意的点：
 *    1. 所有内容都需要放在模版字符串中，不能从外部引入，比如 CSS、图片，可以看到 img 的 src 值是 base64 之后的内容
 *    2. 页眉天生会有 20px 的上边距，需要处理掉。如果不知道的话，会发现无法很难做到垂直居中，甚至看到页眉页脚空白
 *    3. 页脚天生会有 18px 的下边距，需要处理掉
 */
import crypto from 'crypto'

// 页眉
export function headerTemplate() {
  return `<div style="box-sizing: border-box; width: 100%; height: 40px; text-align: right; margin-right: 40px; margin-top: -20px; display: flex; justify-content: flex-end; align-items: center;">
    <img style="width: 83px; height: 16px;" src='data:image/png;base64,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'></img>
  </div>`
}

// 页脚
export function footerTemplate() {
  return `<div style="box-sizing: border-box; width: 100%; height: 40px; display: flex; justify-content: space-between; align-items: center; margin-bottom: -18px; padding: 0 40px; font-family: PingFangSC-Regular; font-size: 12px;">
    <div style="color: #fafafa;">${crypto.randomUUID()}</div>
    <div style="display: flex; justify-content: space-between; align-items: center; width: 70px; color: #666666;">
      <div><span>共</span> <span class="totalPages"></span> <span>页</span></div>
      <div class="pageNumber" style="font-family: PingFangSC-Semibold; font-weight: bold; color: #BFBFBF;"></div>
    </div>
  </div>`
}
