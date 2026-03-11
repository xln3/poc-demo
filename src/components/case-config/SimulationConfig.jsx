import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

const SCENE_PRESETS = [
  { scene: 'FloorPlan1', labelKey: 'caseConfig.simKitchen' },
  { scene: 'FloorPlan201', labelKey: 'caseConfig.simLivingRoom' },
  { scene: 'FloorPlan301', labelKey: 'caseConfig.simBedroom' },
  { scene: 'FloorPlan401', labelKey: 'caseConfig.simBathroom' },
];

const ENGINE_OPTIONS = [
  { value: 'ai2thor', labelKey: 'caseConfig.simEngineAi2thor' },
  { value: 'custom', labelKey: 'caseConfig.simEngineCustom' },
];

export default function SimulationConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const sim = config.act_config.simulation;

  return (
    <div className="space-y-3">
      {/* A. Engine + Scene */}
      <div className="space-y-2">
        <div className="flex gap-3">
          {/* Engine selector */}
          <div className="w-40 shrink-0">
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.simEngine')}</label>
            <select
              value={sim.engine}
              onChange={(e) => updateField('act_config.simulation.engine', e.target.value)}
              className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {ENGINE_OPTIONS.map(({ value, labelKey }) => (
                <option key={value} value={value}>{t(labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Scene Name with datalist */}
          <div className="flex-1 min-w-0">
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.sceneName')}</label>
            <input
              type="text"
              list="scene-suggestions"
              value={sim.scene_name}
              onChange={(e) => updateField('act_config.simulation.scene_name', e.target.value)}
              className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="FloorPlan1"
            />
            <datalist id="scene-suggestions">
              <option value="FloorPlan1">{t('caseConfig.simKitchen')}</option>
              <option value="FloorPlan201">{t('caseConfig.simLivingRoom')}</option>
              <option value="FloorPlan301">{t('caseConfig.simBedroom')}</option>
              <option value="FloorPlan401">{t('caseConfig.simBathroom')}</option>
            </datalist>
          </div>
        </div>

        {/* Scene Presets */}
        <div>
          <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.simScenePresets')}</label>
          <div className="flex gap-2">
            {SCENE_PRESETS.map(({ scene, labelKey }) => (
              <button
                key={scene}
                type="button"
                onClick={() => updateField('act_config.simulation.scene_name', scene)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  sim.scene_name === scene
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-surface text-on-surface border-edge hover:bg-surface-hover'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* B. Task Configuration */}
      <div className="space-y-2">
        <div className="flex gap-3">
          {/* Case ID */}
          <div className="w-48 shrink-0">
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.simCaseId')}</label>
            <input
              type="text"
              value={sim.case_id}
              onChange={(e) => updateField('act_config.simulation.case_id', e.target.value)}
              className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="e.g. SAB-001"
            />
          </div>

          {/* Max Steps */}
          <div className="w-28 shrink-0">
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.simMaxSteps')}</label>
            <input
              type="number"
              value={sim.max_steps}
              onChange={(e) => updateField('act_config.simulation.max_steps', Number(e.target.value))}
              min={1}
              max={500}
              className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        {/* Instruction */}
        <div>
          <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.simInstruction')}</label>
          <textarea
            value={sim.instruction}
            onChange={(e) => updateField('act_config.simulation.instruction', e.target.value)}
            rows={3}
            className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                       placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
            placeholder={t('caseConfig.simInstructionPlaceholder')}
          />
        </div>
      </div>

      {/* C. Multimodal Configuration */}
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.simMultimodal')}</label>
        <div className="flex gap-3">
          {/* Vision toggle */}
          <button
            type="button"
            onClick={() => updateField('act_config.simulation.multimodal.vision', !sim.multimodal.vision)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              sim.multimodal.vision
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-surface text-on-surface border-edge hover:bg-surface-hover'
            }`}
          >
            <span className="text-sm">{sim.multimodal.vision ? '\u2713' : '\u2717'}</span>
            {t('caseConfig.simVision')}
          </button>

          {/* Audio toggle */}
          <button
            type="button"
            onClick={() => updateField('act_config.simulation.multimodal.audio', !sim.multimodal.audio)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              sim.multimodal.audio
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-surface text-on-surface border-edge hover:bg-surface-hover'
            }`}
          >
            <span className="text-sm">{sim.multimodal.audio ? '\u2713' : '\u2717'}</span>
            {t('caseConfig.simAudio')}
          </button>
        </div>
      </div>

      {/* D. Hint text */}
      <p className="text-xs text-on-dim">
        AI2-THOR / SafeAgentBench
      </p>
    </div>
  );
}
