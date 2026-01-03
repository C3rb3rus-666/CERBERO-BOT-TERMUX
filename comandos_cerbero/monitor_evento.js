export async function onGroupUpdate(sock, update) {
  try {
    const { id, participants, action } = update; // Datos del evento

    // Helper para normalizar posibles representaciones de JID en el payload
    function normalizeJidField(field) {
      if (!field) return null;
      if (typeof field === 'string') {
        if (field.endsWith('@lid')) return `${field.split('@')[0]}@s.whatsapp.net`;
        return field;
      }
      if (typeof field === 'object') {
        if (field.id && typeof field.id === 'string') {
          if (field.id.endsWith('@lid')) return `${field.id.split('@')[0]}@s.whatsapp.net`;
          return field.id;
        }
        if (field.jid && typeof field.jid === 'string') return field.jid;
        if (field.phoneNumber && typeof field.phoneNumber === 'string') return field.phoneNumber;
      }
      return null;
    }

    if (action === 'demote') {
      // Helper que extrae JID de distintos formatos de participante o campos del payload
      function extractJid(val) {
        if (!val) return null;
        if (typeof val === 'string') return val.includes('@') ? val : `${val}@s.whatsapp.net`;
        if (typeof val === 'object') {
          return val.id || val.jid || val.participant || val.user || val.phoneNumber || null;
        }
        return null;
      }

      const removedAdminRaw = Array.isArray(participants) && participants.length ? participants[0] : null;
      const removedAdmin = extractJid(removedAdminRaw);

      // Helper para extraer un actor de forma robusta probando muchos campos y normalizando JIDs
      function findActor(u, parts) {
        const tried = [];
        const pushCandidate = (v) => {
          if (!v) return;
          let n = normalizeJidField(v);
          if (!n && typeof v === 'string' && !v.includes('@')) n = `${v}@s.whatsapp.net`;
          if (n) tried.push(n);
        };

        // Campos directos del update
        ['actor','author','participant','by','initiator','from','sender','authorId','actorId','admin','performer'].forEach(f => pushCandidate(u?.[f]));

        // Revisar cada participante por campos usados por distintos payloads
        if (Array.isArray(parts)) {
          for (const p of parts) {
            ['actor','performedBy','performed_by','by','removedBy','addedBy','performer','author','participant','id','jid','user','phoneNumber'].forEach(f => pushCandidate(p?.[f]));
          }
        }

        // El fallback heurístico: si hay >1 participantes, el último a veces es el actor
        if (!tried.length && Array.isArray(parts) && parts.length > 1) {
          const last = parts[parts.length - 1];
          const cand = normalizeJidField(last) || normalizeJidField(last?.id) || normalizeJidField(last?.participant) || (typeof last === 'string' && last);
          if (cand) tried.push(cand);
        }

        // Filtrar nulos y devolver el primer candidato válido normalizado
        const valid = tried.map(t => {
          if (!t) return null;
          return t.includes('@') ? t : `${t}@s.whatsapp.net`;
        }).filter(Boolean);

        if (valid.length) return { actor: valid[0], tried };
        return { actor: null, tried };
      }

      // Usar la función para obtener actor y candidatos (log para depuración)
      const actorResult = findActor(update, participants);
      let actor = actorResult.actor;
      console.log('Demote event details (improved):', { action, participants, removedAdminRaw, removedAdmin, actorCandidates: actorResult.tried, actor, update });

      // Resolver nombres con tolerancia y fallbacks
      const resolveName = (jid) => {
        if (!jid) return null;
        const fallback = jid.split('@')[0];
        try {
          if (update && update.authorPn && (extractJid(update.author) === jid || update.author === jid)) return update.authorPn;
          if (sock && sock.store && sock.store.contacts) {
            const contacts = sock.store.contacts;
            const c = contacts[jid] ?? (typeof contacts.get === 'function' ? contacts.get(jid) : undefined);
            if (c) return c.notify || c.name || fallback;
          }
          if (sock && sock.contacts) {
            const c = sock.contacts[jid] ?? (typeof sock.contacts.get === 'function' ? sock.contacts.get(jid) : undefined);
            if (c) return c.notify || c.name || fallback;
          }
          return fallback;
        } catch (e) {
          console.error('Error resolviendo nombre para', jid, e);
          return fallback;
        }
      };

      const actorName = actor ? resolveName(actor) : null;
      const removedName = removedAdmin ? resolveName(removedAdmin) : 'un administrador';

      // Preparar menciones garantizando JIDs válidos
      const mentions = [];
      if (actor) mentions.push(actor);
      if (removedAdmin && removedAdmin !== actor) mentions.push(removedAdmin);

      // Formato más explícito y con JIDs para facilitar debugging
      let text;
      if (actor && removedAdmin) {
        if (actor === removedAdmin) {
          text = `⚠️ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** El administrador ${removedName} (${removedAdmin}) ha perdido sus privilegios (acción auto-ejecutada).`;
        } else {
          text = `⚠️ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** ${actorName || actor} (${actor}) ha removido como administrador a ${removedName} (${removedAdmin}).`;
        }
      } else if (removedAdmin) {
        text = `⚠️ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** El usuario ${removedName} (${removedAdmin}) ha sido removido como administrador (autor desconocido).`;
      } else {
        text = `⚠️ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** Un administrador ha sido removido (detalles incompletos).`;
      }

      await sock.sendMessage(id, { text, mentions });
    }

    if (action === 'promote') {
      function extractJid(val) {
        if (!val) return null;
        if (typeof val === 'string') return val.includes('@') ? val : `${val}@s.whatsapp.net`;
        if (typeof val === 'object') {
          return val.id || val.jid || val.participant || val.user || val.phoneNumber || null;
        }
        return null;
      }

      const promotedAdminRaw = Array.isArray(participants) && participants.length ? participants[0] : null;
      const promotedAdmin = extractJid(promotedAdminRaw);

      const actorResult = findActor(update, participants);
      let actor = actorResult.actor;
      console.log('Promote event details (improved):', { action, participants, promotedAdminRaw, promotedAdmin, actorCandidates: actorResult.tried, actor, update });

      const resolveName = (jid) => {
        if (!jid) return null;
        const fallback = jid.split('@')[0];
        try {
          if (update && update.authorPn && (extractJid(update.author) === jid || update.author === jid)) return update.authorPn;
          if (sock && sock.store && sock.store.contacts) {
            const contacts = sock.store.contacts;
            const c = contacts[jid] ?? (typeof contacts.get === 'function' ? contacts.get(jid) : undefined);
            if (c) return c.notify || c.name || fallback;
          }
          if (sock && sock.contacts) {
            const c = sock.contacts[jid] ?? (typeof sock.contacts.get === 'function' ? sock.contacts.get(jid) : undefined);
            if (c) return c.notify || c.name || fallback;
          }
          return fallback;
        } catch (e) {
          console.error('Error resolviendo nombre para', jid, e);
          return fallback;
        }
      };

      const actorName = actor ? resolveName(actor) : null;
      const promotedName = promotedAdmin ? resolveName(promotedAdmin) : 'un usuario';

      const mentions = [];
      if (actor) mentions.push(actor);
      if (promotedAdmin && promotedAdmin !== actor) mentions.push(promotedAdmin);

      let text;
      if (actor && promotedAdmin) {
        text = `✅ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** ${actorName || actor} (${actor}) ha promovido a ${promotedName} (${promotedAdmin}) a administrador.`;
      } else if (promotedAdmin) {
        text = `✅ **[𝐂𝐄𝐑𝐄𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** El usuario ${promotedName} (${promotedAdmin}) ha sido promovido a administrador (autor desconocido).`;
      } else {
        text = `✅ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** Se ha promovido a un usuario a administrador (detalles incompletos).`;
      }

      await sock.sendMessage(id, { text, mentions });
    }

    // Cuando hay participantes añadidos al grupo, establecer baseline para contar desde su ingreso
    if (action === 'add' || action === 'promote' || action === 'invite') {
      try {
        const added = Array.isArray(participants) ? participants : [];
        for (const raw of added) {
          const jid = normalizeJidField(raw);
          if (!jid) continue;
          try { await import('../utils/messageCounter.js').then(m => m.setBaseline(id, jid)); } catch (e) { /* no bloquear */ }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('Error en onGroupUpdate:', e);
  }
}
  