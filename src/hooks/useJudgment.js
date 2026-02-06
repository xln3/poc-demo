import { useState } from 'react';
import { CONFIG } from '../config.js';

/**
 * Manages judge configuration and human judgment state.
 */
export function useJudgment() {
  const [judgeConfig, setJudgeConfig] = useState({
    model: CONFIG.judgeModel,
    systemPrompt: CONFIG.defaultJudgePrompt,
  });
  const [judgeConfigOpen, setJudgeConfigOpen] = useState(false);

  const [humanJudgment, setHumanJudgment] = useState({
    auditorCode: '',
    score: null,
    summary: '',
  });

  const [annotationModal, setAnnotationModal] = useState({ open: false, recordId: null });
  const [newAnnotation, setNewAnnotation] = useState({
    source: 'human',
    author: '',
    content: '',
  });

  return {
    judgeConfig, setJudgeConfig,
    judgeConfigOpen, setJudgeConfigOpen,
    humanJudgment, setHumanJudgment,
    annotationModal, setAnnotationModal,
    newAnnotation, setNewAnnotation,
  };
}
