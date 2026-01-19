// ============ 隐藏技术枚举库 ============

import { FileType } from '../types.js';

export const HidingTechniques = {
  // PDF 隐藏技术
  PDF_WHITE_TEXT: {
    id: 'pdf_white_text',
    name: '白色字体',
    description: '使用与背景同色的字体隐藏文本',
    fileTypes: [FileType.PDF],
    detectability: 'low'
  },
  PDF_ZERO_FONT: {
    id: 'pdf_zero_font',
    name: '0号字体',
    description: '使用0号字体大小隐藏文本',
    fileTypes: [FileType.PDF],
    detectability: 'low'
  },
  PDF_METADATA: {
    id: 'pdf_metadata',
    name: 'PDF元数据字段',
    description: '在PDF元数据（Author/Subject/Keywords）中嵌入指令',
    fileTypes: [FileType.PDF],
    detectability: 'medium'
  },
  PDF_XMP: {
    id: 'pdf_xmp',
    name: 'XMP数据',
    description: '在PDF的XMP扩展元数据中隐藏内容',
    fileTypes: [FileType.PDF],
    detectability: 'medium'
  },
  PDF_ANNOTATION: {
    id: 'pdf_annotation',
    name: 'PDF注释',
    description: '在不可见注释中嵌入指令',
    fileTypes: [FileType.PDF],
    detectability: 'low'
  },
  PDF_EMBEDDED_OBJECT: {
    id: 'pdf_embedded_object',
    name: '嵌入式对象属性',
    description: '在嵌入对象的属性中隐藏内容',
    fileTypes: [FileType.PDF],
    detectability: 'high'
  },
  PDF_SMALL_FONT: {
    id: 'pdf_small_font',
    name: '小字号脚注',
    description: '使用极小字号的脚注文字',
    fileTypes: [FileType.PDF],
    detectability: 'low'
  },
  PDF_LIGHT_COLOR: {
    id: 'pdf_light_color',
    name: '浅色字体',
    description: '使用接近背景色的浅色字体',
    fileTypes: [FileType.PDF],
    detectability: 'low'
  },
  PDF_MARGIN_CONTENT: {
    id: 'pdf_margin_content',
    name: '页边距外内容',
    description: '在打印页边距外放置内容',
    fileTypes: [FileType.PDF],
    detectability: 'medium'
  },

  // Word 文档隐藏技术
  WORD_HIDDEN_TEXT: {
    id: 'word_hidden_text',
    name: 'Word隐藏文本',
    description: '使用Word的隐藏文本格式',
    fileTypes: [FileType.DOCX],
    detectability: 'low'
  },
  WORD_COMMENT: {
    id: 'word_comment',
    name: 'Word文档注释',
    description: '在批注/注释中嵌入指令',
    fileTypes: [FileType.DOCX],
    detectability: 'low'
  },
  WORD_FOOTNOTE: {
    id: 'word_footnote',
    name: '脚注尾注',
    description: '在脚注或尾注中隐藏内容',
    fileTypes: [FileType.DOCX],
    detectability: 'low'
  },
  WORD_PROPERTIES: {
    id: 'word_properties',
    name: '文档属性字段',
    description: '在文档属性/自定义字段中嵌入',
    fileTypes: [FileType.DOCX],
    detectability: 'medium'
  },
  WORD_HIDDEN_PARAGRAPH: {
    id: 'word_hidden_paragraph',
    name: 'Word隐藏段落',
    description: '使用隐藏段落格式',
    fileTypes: [FileType.DOCX],
    detectability: 'low'
  },

  // Excel 隐藏技术
  EXCEL_HIDDEN_SHEET: {
    id: 'excel_hidden_sheet',
    name: 'Excel隐藏Sheet',
    description: '在隐藏的工作表中嵌入指令',
    fileTypes: [FileType.XLSX],
    detectability: 'low'
  },
  EXCEL_CELL_COMMENT: {
    id: 'excel_cell_comment',
    name: 'Excel单元格批注',
    description: '在单元格批注中隐藏内容',
    fileTypes: [FileType.XLSX],
    detectability: 'low'
  },
  EXCEL_HIDDEN_ROW: {
    id: 'excel_hidden_row',
    name: 'Excel隐藏行列',
    description: '在隐藏的行或列中放置内容',
    fileTypes: [FileType.XLSX],
    detectability: 'low'
  },
  EXCEL_WHITE_FONT: {
    id: 'excel_white_font',
    name: 'Excel白色字体',
    description: '使用白色字体隐藏单元格内容',
    fileTypes: [FileType.XLSX],
    detectability: 'low'
  },

  // 图片隐藏技术
  IMAGE_EXIF: {
    id: 'image_exif',
    name: '图片EXIF数据',
    description: '在EXIF元数据字段中嵌入指令',
    fileTypes: [FileType.IMAGE],
    detectability: 'medium'
  },
  IMAGE_EMBEDDED_TEXT: {
    id: 'image_embedded_text',
    name: '图片嵌入文字',
    description: '在图片中嵌入隐写文字',
    fileTypes: [FileType.IMAGE],
    detectability: 'high'
  },
  IMAGE_XMP: {
    id: 'image_xmp',
    name: '图片XMP数据',
    description: '在图片XMP元数据中隐藏',
    fileTypes: [FileType.IMAGE],
    detectability: 'medium'
  },

  // 代码隐藏技术
  CODE_COMMENT: {
    id: 'code_comment',
    name: '代码注释',
    description: '在代码注释中嵌入指令',
    fileTypes: [FileType.CODE],
    detectability: 'low'
  },
  CODE_MULTILINE_COMMENT: {
    id: 'code_multiline_comment',
    name: '多行注释块',
    description: '在多行注释中隐藏大段指令',
    fileTypes: [FileType.CODE],
    detectability: 'low'
  },
  CODE_DOCSTRING: {
    id: 'code_docstring',
    name: '文档字符串',
    description: '在docstring中嵌入指令',
    fileTypes: [FileType.CODE],
    detectability: 'low'
  },
  CODE_VAR_NAME: {
    id: 'code_var_name',
    name: '变量命名指令',
    description: '在变量名中编码指令',
    fileTypes: [FileType.CODE],
    detectability: 'high'
  },

  // HTML 隐藏技术
  HTML_COMMENT: {
    id: 'html_comment',
    name: 'HTML注释',
    description: '在HTML注释中嵌入指令',
    fileTypes: [FileType.HTML],
    detectability: 'low'
  },
  HTML_HIDDEN_DIV: {
    id: 'html_hidden_div',
    name: '隐藏div',
    description: '使用display:none隐藏元素',
    fileTypes: [FileType.HTML],
    detectability: 'low'
  },
  HTML_DATA_ATTR: {
    id: 'html_data_attr',
    name: 'data-属性',
    description: '在HTML data-属性中嵌入',
    fileTypes: [FileType.HTML],
    detectability: 'medium'
  },

  // Markdown 隐藏技术
  MARKDOWN_HTML_COMMENT: {
    id: 'markdown_html_comment',
    name: 'Markdown HTML注释',
    description: '在Markdown中使用HTML注释',
    fileTypes: [FileType.MARKDOWN],
    detectability: 'low'
  },
  MARKDOWN_LINK_TITLE: {
    id: 'markdown_link_title',
    name: '链接title属性',
    description: '在链接title中隐藏内容',
    fileTypes: [FileType.MARKDOWN],
    detectability: 'medium'
  },

  // JSON 隐藏技术
  JSON_PSEUDO_COMMENT: {
    id: 'json_pseudo_comment',
    name: 'JSON伪注释字段',
    description: '使用 _comment 或 // 字段',
    fileTypes: [FileType.JSON],
    detectability: 'low'
  },
  JSON_UNDERSCORE_FIELD: {
    id: 'json_underscore_field',
    name: '下划线前缀字段',
    description: '使用 _ 前缀的字段名',
    fileTypes: [FileType.JSON],
    detectability: 'low'
  },

  // Unicode 隐藏技术
  UNICODE_ZERO_WIDTH: {
    id: 'unicode_zero_width',
    name: 'Unicode零宽字符',
    description: '使用U+200B等零宽字符编码信息',
    fileTypes: [FileType.PDF, FileType.DOCX, FileType.HTML, FileType.MARKDOWN],
    detectability: 'high'
  },
  UNICODE_HOMOGLYPH: {
    id: 'unicode_homoglyph',
    name: 'Unicode同形字符',
    description: '使用外观相似的不同字符替换',
    fileTypes: [FileType.PDF, FileType.DOCX, FileType.CODE],
    detectability: 'high'
  },
  UNICODE_RTL_OVERRIDE: {
    id: 'unicode_rtl_override',
    name: 'RTL覆盖字符',
    description: '使用RTL覆盖改变文本显示顺序',
    fileTypes: [FileType.PDF, FileType.DOCX, FileType.CODE],
    detectability: 'medium'
  },

  // 音视频隐藏技术
  AUDIO_METADATA: {
    id: 'audio_metadata',
    name: '音频元数据',
    description: '在ID3标签等音频元数据中嵌入',
    fileTypes: [FileType.AUDIO],
    detectability: 'medium'
  },
  AUDIO_INAUDIBLE: {
    id: 'audio_inaudible',
    name: '不可听频段',
    description: '在人耳不可听频段嵌入信息',
    fileTypes: [FileType.AUDIO],
    detectability: 'high'
  },
  VIDEO_METADATA: {
    id: 'video_metadata',
    name: '视频元数据',
    description: '在视频文件元数据中嵌入',
    fileTypes: [FileType.VIDEO],
    detectability: 'medium'
  },
  VIDEO_SUBTITLE: {
    id: 'video_subtitle',
    name: '隐藏字幕轨道',
    description: '在不可见字幕轨道中嵌入',
    fileTypes: [FileType.VIDEO],
    detectability: 'low'
  },

  // PPT 隐藏技术
  PPTX_NOTES: {
    id: 'pptx_notes',
    name: 'PPT备注',
    description: '在演讲者备注中嵌入',
    fileTypes: [FileType.PPTX],
    detectability: 'low'
  },
  PPTX_HIDDEN_SLIDE: {
    id: 'pptx_hidden_slide',
    name: 'PPT隐藏幻灯片',
    description: '在隐藏的幻灯片中嵌入',
    fileTypes: [FileType.PPTX],
    detectability: 'low'
  },
  PPTX_OFF_CANVAS: {
    id: 'pptx_off_canvas',
    name: 'PPT画布外元素',
    description: '在幻灯片可视区域外放置元素',
    fileTypes: [FileType.PPTX],
    detectability: 'medium'
  }
};

// 按文件类型分组的隐藏技术
export function getTechniquesByFileType(fileType) {
  return Object.values(HidingTechniques).filter(
    tech => tech.fileTypes.includes(fileType)
  );
}

// 获取技术ID列表
export function getTechniqueIds(techniqueKeys) {
  return techniqueKeys.map(key => HidingTechniques[key]?.id).filter(Boolean);
}
