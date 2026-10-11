export async function prepareWorkerPhoto(file: File, kind: 'photo' | 'idCard' = 'photo'): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose a JPG, PNG or WebP image up to 5 MB.')
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, (kind === 'idCard' ? 1600 : 384) / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to read this image. Choose another photo.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.75, 0.65, 0.5]) {
      const result = canvas.toDataURL('image/jpeg', quality)
      if (result.length <= (kind === 'idCard' ? 1900000 : 350000)) return result
    }
    throw new Error('Unable to read this image. Choose another photo.')
  } catch {
    throw new Error('Unable to read this image. Choose another photo.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
