import { useTranslation } from 'react-i18next';

/**
 * Multi-media renderer: PDF (iframe), image, audio, video.
 */
export default function MediaRenderer({ event }) {
  const { t } = useTranslation();
  const { mediaType, url, alt, mimeType } = event.data;

  if (mediaType === 'image' || mimeType?.startsWith('image/')) {
    return (
      <div className="bg-surface-muted/50 rounded-lg p-2">
        <img src={url} alt={alt || ''} className="max-w-full max-h-80 rounded" />
      </div>
    );
  }

  if (mediaType === 'pdf' || mimeType === 'application/pdf') {
    return (
      <div className="bg-surface-muted/50 rounded-lg p-2">
        <iframe src={url} className="w-full h-80 rounded border border-edge-strong" title={alt || 'PDF'} />
      </div>
    );
  }

  if (mediaType === 'audio' || mimeType?.startsWith('audio/')) {
    return (
      <div className="bg-surface-muted/50 rounded-lg p-2">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (mediaType === 'video' || mimeType?.startsWith('video/')) {
    return (
      <div className="bg-surface-muted/50 rounded-lg p-2">
        <video src={url} controls className="w-full max-h-80 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-surface-muted/50 rounded-lg p-2 text-xs text-on-dim">
      {t('sandbox.unsupportedMediaType')}: {mediaType || mimeType}
    </div>
  );
}
