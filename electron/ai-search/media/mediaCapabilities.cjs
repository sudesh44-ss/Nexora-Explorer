"use strict";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"]);

function isImageFile(extension) {
  if (!extension) return false;
  return IMAGE_EXTENSIONS.has(extension.toLowerCase());
}

function isAudioFile(extension) {
  if (!extension) return false;
  return AUDIO_EXTENSIONS.has(extension.toLowerCase());
}

function isVideoFile(extension) {
  if (!extension) return false;
  return VIDEO_EXTENSIONS.has(extension.toLowerCase());
}

function getMediaType(extension) {
  if (!extension) return null;
  const ext = extension.toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}

module.exports = {
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  isImageFile,
  isAudioFile,
  isVideoFile,
  getMediaType,
};
