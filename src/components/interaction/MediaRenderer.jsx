/**
 * Multi-media renderer: PDF (iframe), image, audio, video.
 */
export default function MediaRenderer({ event }) {
  const { mediaType, url, alt, mimeType } = event.data;

  if (mediaType === 'image' || mimeType?.startsWith('image/')) {
    return (
      <div className="bg-slate-700/50 rounded-lg p-2">
        <img src={url} alt={alt || ''} className="max-w-full max-h-80 rounded" />
      </div>
    );
  }

  if (mediaType === 'pdf' || mimeType === 'application/pdf') {
    return (
      <div className="bg-slate-700/50 rounded-lg p-2">
        <iframe src={url} className="w-full h-80 rounded border border-slate-600" title={alt || 'PDF'} />
      </div>
    );
  }

  if (mediaType === 'audio' || mimeType?.startsWith('audio/')) {
    return (
      <div className="bg-slate-700/50 rounded-lg p-2">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (mediaType === 'video' || mimeType?.startsWith('video/')) {
    return (
      <div className="bg-slate-700/50 rounded-lg p-2">
        <video src={url} controls className="w-full max-h-80 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-slate-700/50 rounded-lg p-2 text-xs text-slate-500">
      不支持的媒体类型: {mediaType || mimeType}
    </div>
  );
}
