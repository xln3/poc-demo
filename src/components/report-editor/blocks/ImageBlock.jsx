import { createReactBlockSpec } from '@blocknote/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Custom BlockNote block for AI-generated images.
 * Stores image as base64 data URL with prompt metadata.
 */
export const ImageBlock = createReactBlockSpec(
  {
    type: 'reportImage',
    propSchema: {
      src: { default: '' },
      caption: { default: '' },
      prompt: { default: '' },      // original generation prompt
      size: { default: '1024x1024' },
      alt: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { block } = props;
      const { t } = useTranslation('reportEditor');
      const [captionText, setCaptionText] = useState(block.props.caption || '');

      const handleCaptionBlur = () => {
        if (captionText !== block.props.caption) {
          props.editor.updateBlock(block, {
            props: { ...block.props, caption: captionText },
          });
        }
      };

      if (!block.props.src) {
        return (
          <div className="my-2 p-8 border-2 border-dashed border-edge rounded-lg text-center text-on-canvas/50">
            <p className="text-sm">{t('image.noImage', 'No image. Use /image to generate one.')}</p>
          </div>
        );
      }

      return (
        <div className="image-block-wrapper my-2" data-image-block-id={block.id}>
          <img
            src={block.props.src}
            alt={block.props.alt || block.props.caption || 'Generated image'}
            className="max-w-full rounded-lg border border-edge"
          />
          <input
            type="text"
            value={captionText}
            onChange={e => setCaptionText(e.target.value)}
            onBlur={handleCaptionBlur}
            placeholder={t('image.addCaption', 'Add caption...')}
            className="w-full mt-1 px-2 py-1 text-xs text-center text-on-canvas/60 bg-transparent border-none outline-none focus:text-on-canvas"
          />
        </div>
      );
    },
    toExternalHTML: (block) => {
      const { src, caption, prompt, size } = block.props;
      return (
        <div>
          <img
            src={src}
            alt={caption}
            className="report-image"
            data-generated="true"
            data-prompt={prompt}
            data-size={size}
          />
          {caption && <p className="image-caption">{caption}</p>}
        </div>
      );
    },
    parse: (el) => {
      if (el.tagName === 'IMG' && el.getAttribute('data-generated') === 'true') {
        return {
          src: el.getAttribute('src') || '',
          caption: el.getAttribute('alt') || '',
          prompt: el.getAttribute('data-prompt') || '',
          size: el.getAttribute('data-size') || '1024x1024',
        };
      }
      return undefined;
    },
  }
);
