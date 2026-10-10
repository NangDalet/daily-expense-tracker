export const MAX_PROFILE_FILE_BYTES = 5 * 1024 * 1024

export function cropProfilePhoto(image: HTMLImageElement, zoom: number, horizontal: number, vertical: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare this photo.')
  const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom
  const x = (image.naturalWidth - side) * horizontal / 100
  const y = (image.naturalHeight - side) * vertical / 100
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 256, 256)
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, x, y, side, side, 0, 0, 256, 256)
  return canvas.toDataURL('image/jpeg', 0.9)
}
