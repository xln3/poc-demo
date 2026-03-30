import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { ChartBlock } from './ChartBlock.jsx';
import { CalloutBlock } from './CalloutBlock.jsx';
import { ImageBlock } from './ImageBlock.jsx';

/**
 * Extended BlockNote schema with custom block types for the report editor.
 *
 * Custom blocks:
 * - chart: ECharts chart with JSON config
 * - callout: Warning/info/success/error callout boxes
 * - reportImage: AI-generated images with metadata
 *
 * Custom inline content:
 * - (risk badges handled via HTML class styling, not custom inline spec)
 */
export const reportSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    chart: ChartBlock(),
    callout: CalloutBlock(),
    reportImage: ImageBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
  },
});

/**
 * Slash menu items for custom blocks.
 */
export function getCustomSlashMenuItems(editor) {
  return [
    {
      title: 'Chart',
      subtext: 'Insert an ECharts chart',
      group: 'Media',
      onItemClick: () => {
        editor.insertBlocks(
          [{ type: 'chart', props: { config: '{"title":{"text":"New Chart"},"xAxis":{"type":"category","data":["A","B","C"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[10,20,30]}]}' } }],
          editor.getTextCursorPosition().block,
          'after'
        );
      },
      aliases: ['chart', 'echarts', 'graph'],
      badge: '/chart',
    },
    {
      title: 'Image',
      subtext: 'Generate an AI image',
      group: 'Media',
      onItemClick: () => {
        editor.insertBlocks(
          [{ type: 'reportImage', props: { src: '', caption: '', prompt: '' } }],
          editor.getTextCursorPosition().block,
          'after'
        );
      },
      aliases: ['image', 'picture', 'photo'],
      badge: '/image',
    },
    {
      title: 'Callout',
      subtext: 'Insert a callout box',
      group: 'Basic',
      onItemClick: () => {
        editor.insertBlocks(
          [{ type: 'callout', props: { variant: 'info' } }],
          editor.getTextCursorPosition().block,
          'after'
        );
      },
      aliases: ['callout', 'alert', 'note', 'warning'],
      badge: '/callout',
    },
  ];
}
