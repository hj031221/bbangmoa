// 프로필 아바타용 클라이언트 리사이즈: 파일을 정사각 center-crop 후 image/jpeg Blob 으로 반환한다.
// maxSize(기본 512)보다 원본이 작으면 확대하지 않는다. 투명 영역은 흰 배경으로 채운다.
export async function resizeToSquareJpeg(file, maxSize = 512) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) // EXIF 방향 보정
  try {
    const side = Math.min(bitmap.width, bitmap.height) // 짧은 변 기준 정사각
    const out = Math.min(maxSize, side)                // 업스케일 금지
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 얻지 못했어요.')
    ctx.fillStyle = '#fff' // 투명 PNG → 흰 배경 (JPEG 는 알파 미지원)
    ctx.fillRect(0, 0, out, out)
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
      0, 0, out, out,
    )
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('이미지 인코딩에 실패했어요.')
    return blob
  } finally {
    bitmap.close() // 성공·throw 모두에서 해제
  }
}
