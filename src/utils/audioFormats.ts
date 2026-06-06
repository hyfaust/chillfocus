export const SUPPORTED_AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|aac|m4a|opus|webm|weba)$/i;

export function isSupportedAudioFile(file: File): boolean {
  return SUPPORTED_AUDIO_EXTENSIONS.test(file.name);
}

export function filterAudioFiles(files: File[]): File[] {
  return files.filter(isSupportedAudioFile);
}
