import { useStore } from '../store/useStore';

export function exportModelToDesktop() {
  const state = useStore.getState();
  const params = state.engineeringParams as Record<string, unknown> || {};
  const threeDData = state.threeDData as Record<string, unknown> | null;
  const pipelineSteps = state.pipelineSteps;

  // Collect model data for export
  const exportData = {
    type: 'CAIAO Steel Frame Project',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    projectName: (params.name || '钢框架') as string,

    parameters: {
      name: params.name,
      grid_x: params.grid_x,
      grid_y: params.grid_y,
      num_stories: params.num_stories,
      story_heights: params.story_heights,
      column_section: params.column_section,
      beam_section: params.beam_section,
      material: params.material,
      dead_load: params.dead_load,
      live_load: params.live_load,
      wind_pressure: params.wind_pressure,
    },

    // 3D model from backend (if available)
    modelData: threeDData ? {
      nodes: threeDData.nodes,
      elements: threeDData.elements,
      supports: threeDData.supports,
      load_arrows: threeDData.load_arrows,
      section_dimensions: threeDData.section_dimensions,
    } : null,

    pipelineStatus: pipelineSteps,
  };

  // Generate filename
  const ts = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const filename = `CAIAO-${(params.name || 'steel-frame')}-${ts}.caiao.json`;

  // Trigger download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
