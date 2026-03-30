import { createReactBlockSpec } from '@blocknote/react';

const CALLOUT_ICONS = {
  warning: '\u26a0\ufe0f',
  info: '\u2139\ufe0f',
  success: '\u2705',
  error: '\u274c',
};

const CALLOUT_STYLES = {
  warning: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  info: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  success: 'border-green-400 bg-green-50 dark:bg-green-900/20',
  error: 'border-red-400 bg-red-50 dark:bg-red-900/20',
};

/**
 * Custom BlockNote block for callout boxes (warning/info/success/error).
 */
export const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      variant: { default: 'info', values: ['warning', 'info', 'success', 'error'] },
    },
    content: 'inline',
  },
  {
    render: (props) => {
      const variant = props.block.props.variant || 'info';
      const icon = CALLOUT_ICONS[variant] || CALLOUT_ICONS.info;
      const style = CALLOUT_STYLES[variant] || CALLOUT_STYLES.info;

      return (
        <div className={`callout-block flex items-start gap-2 p-3 my-2 rounded-lg border-l-4 ${style}`}>
          <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0 inline-content" ref={props.contentRef} />
        </div>
      );
    },
    toExternalHTML: (props) => {
      const variant = props.block.props.variant || 'info';
      const icon = CALLOUT_ICONS[variant] || CALLOUT_ICONS.info;
      return (
        <div className={`callout callout-${variant}`}>
          <span>{icon}</span>
          <div ref={props.contentRef} />
        </div>
      );
    },
    parse: (el) => {
      if (el.tagName === 'DIV' && el.classList?.contains('callout')) {
        let variant = 'info';
        for (const v of ['warning', 'info', 'success', 'error']) {
          if (el.classList.contains(`callout-${v}`)) {
            variant = v;
            break;
          }
        }
        return { variant };
      }
      return undefined;
    },
  }
);
