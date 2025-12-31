(async () => {
  try {
    const m = await import('wa-sticker-formatter');
    console.log('[TEST] módulo importado con llaves:', Object.keys(m));
    console.log('[TEST] tipo de default:', typeof m.default);
    console.log('[TEST] tipo de Sticker:', typeof m.Sticker);
    console.log('[TEST] tipo de createSticker:', typeof m.createSticker);
    if (m.default && typeof m.default === 'object') console.log('[TEST] llaves de default:', Object.keys(m.default));
  } catch (e) {
    console.error('[TEST] error importando:', e);
    process.exit(1);
  }
})();