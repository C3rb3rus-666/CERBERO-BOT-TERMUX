import sharp from 'sharp';
import fs from 'fs';

(async () => {
  try {
    // crear imagen de prueba
    const img = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 200, g: 100, b: 50, alpha: 1 }
      }
    }).png().toBuffer();

    const m = await import('wa-sticker-formatter');
    const ws = m.default ?? m;
    console.log('[CREATE TEST] ws keys:', Object.keys(ws));

    const options = {
      pack: 'CERBERO-BOT',
      author: 'Test',
      quality: 70
    };

    let webp;
    if (typeof ws === 'function') {
      const instance = new ws(img, options);
      console.log('[CREATE TEST] instance proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
      await instance.build();
      const result = await instance.get();
      console.log('[CREATE TEST] get() -> type:', typeof result, 'isBuffer:', Buffer.isBuffer(result));
      if (Buffer.isBuffer(result)) webp = result;
      else if (result?.data && Buffer.isBuffer(result.data)) webp = result.data;
      else webp = Buffer.from(String(result));
    } else if (typeof ws.Sticker === 'function') {
      const instance = new ws.Sticker(img, options);
      console.log('[CREATE TEST] instance proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
      await instance.build();
      const result = await instance.get();
      console.log('[CREATE TEST] get() -> type:', typeof result, 'isBuffer:', Buffer.isBuffer(result));
      if (Buffer.isBuffer(result)) webp = result;
      else if (result?.data && Buffer.isBuffer(result.data)) webp = result.data;
      else webp = Buffer.from(String(result));
    } else {
      throw new Error('No constructor found');
    }

    fs.writeFileSync('/tmp/test-sticker.webp', webp);
    console.log('[CREATE TEST] Sticker creado, tamaño:', webp.length);
  } catch (e) {
    console.error('[CREATE TEST] error:', e);
    process.exit(1);
  }
})();