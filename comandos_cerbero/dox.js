// comandos_cerbero/dox.js
// Minijuego "!dox" — doxxing hacker style (juego divertido).
// Uso: reply al usuario con `!dox` o `!dox @usuario` en grupos.

import crypto from 'crypto';

function randomInt(min, max) {
  const range = max - min + 1;
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32LE(0) % range;
  return num + min;
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomIPv4() {
  return `${randomInt(2, 255)}.${randomInt(0,255)}.${randomInt(0,255)}.${randomInt(1,254)}`;
}

function randomIPv6() {
  const parts = [];
  for (let i = 0; i < 8; i++) parts.push(randomInt(0, 0xffff).toString(16));
  return parts.join(':');
}

function randomMAC() {
  const parts = [];
  for (let i = 0; i < 6; i++) parts.push(randomInt(0, 255).toString(16).padStart(2, '0'));
  return parts.join(':').toUpperCase();
}

function fakeEmailFromName(name) {
  const domains = ['example.com','mailinator.com','fakemail.com','anonmail.io','leaks.me'];
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g,'') || 'user';
  return `${clean}${randomInt(10,999)}@${randomChoice(domains)}`;
}

function fakePhone() {
  // formato internacional ficticio
  return `+${randomInt(1,99)} ${randomInt(100,999)} ${randomInt(1000,9999)}`;
}

function fakeLocation() {
  const cities = [
    'Bogotá, Colombia', 'Medellín, Colombia', 'Cali, Colombia', 'Barranquilla, Colombia', 'Cartagena, Colombia',
    'Lima, Perú', 'Arequipa, Perú', 'Cusco, Perú', 'Trujillo, Perú', 'Chiclayo, Perú',
    'Madrid, España', 'Barcelona, España', 'Valencia, España', 'Sevilla, España', 'Bilbao, España',
    'Ciudad de México, México', 'Guadalajara, México', 'Monterrey, México', 'Puebla, México', 'Tijuana, México',
    'Buenos Aires, Argentina', 'Córdoba, Argentina', 'Rosario, Argentina', 'Mendoza, Argentina', 'La Plata, Argentina',
    'Santiago, Chile', 'Valparaíso, Chile', 'Concepción, Chile', 'Antofagasta, Chile', 'Viña del Mar, Chile',
    'Quito, Ecuador', 'Guayaquil, Ecuador', 'Cuenca, Ecuador', 'Ambato, Ecuador', 'Riobamba, Ecuador',
    'Caracas, Venezuela', 'Maracaibo, Venezuela', 'Valencia, Venezuela', 'Barquisimeto, Venezuela', 'Ciudad Guayana, Venezuela',
    'Panamá, Panamá', 'Colón, Panamá', 'David, Panamá', 'Santiago, Panamá', 'La Chorrera, Panamá',
    'Montevideo, Uruguay', 'Salto, Uruguay', 'Paysandú, Uruguay', 'Las Piedras, Uruguay', 'Rivera, Uruguay',
    'Asunción, Paraguay', 'Ciudad del Este, Paraguay', 'Luque, Paraguay', 'San Lorenzo, Paraguay', 'Lambaré, Paraguay',
    'La Paz, Bolivia', 'Santa Cruz, Bolivia', 'Cochabamba, Bolivia', 'Sucre, Bolivia', 'Oruro, Bolivia',
    'San José, Costa Rica', 'Alajuela, Costa Rica', 'Cartago, Costa Rica', 'Heredia, Costa Rica', 'Puntarenas, Costa Rica',
    'Tegucigalpa, Honduras', 'San Pedro Sula, Honduras', 'Choloma, Honduras', 'La Ceiba, Honduras', 'El Progreso, Honduras',
    'Guatemala City, Guatemala', 'Quetzaltenango, Guatemala', 'Escuintla, Guatemala', 'Mixco, Guatemala', 'Villa Nueva, Guatemala',
    'San Salvador, El Salvador', 'Santa Ana, El Salvador', 'San Miguel, El Salvador', 'Mejicanos, El Salvador', 'Soyapango, El Salvador',
    'Managua, Nicaragua', 'León, Nicaragua', 'Masaya, Nicaragua', 'Chinandega, Nicaragua', 'Granada, Nicaragua',
    'Belmopán, Belize', 'Belize City, Belize', 'San Ignacio, Belize', 'Orange Walk, Belize', 'Corozal, Belize'
  ];
  return randomChoice(cities);
}

function fakeISP() {
  const isps = [
    'FastNet ISP', 'Quantum Telecom', 'HyperWave', 'AndesConnect', 'GlobalLink', 'Zenith ISP',
    'Claro Colombia', 'Movistar Colombia', 'ETB Telecom', 'Tigo Colombia', 'Avantel',
    'Movistar Perú', 'Claro Perú', 'Entel Perú', 'Bitel Perú', 'Win Perú',
    'Movistar España', 'Vodafone España', 'Orange España', 'Yoigo España', 'Jazztel',
    'Telcel México', 'Movistar México', 'AT&T México', 'Megacable', 'Totalplay',
    'Movistar Argentina', 'Claro Argentina', 'Personal Argentina', 'Telecom Argentina', 'Fibertel',
    'Movistar Chile', 'Claro Chile', 'Entel Chile', 'VTR Chile', 'GTD Chile',
    'Movistar Ecuador', 'Claro Ecuador', 'CNT Ecuador', 'TV Cable Ecuador', 'Netlife Ecuador',
    'Movistar Venezuela', 'Cantv Venezuela', 'Digitel Venezuela', 'Intercable Venezuela', 'Supercable Venezuela',
    'Cable Onda Panamá', 'Movistar Panamá', 'Claro Panamá', 'Digicel Panamá', 'Mas Movil Panamá'
  ];
  return randomChoice(isps);
}

function fakeOS(device) {
  const mobileOS = [
    'Android 14', 'Android 13', 'Android 12', 'Android 11', 'Android 10',
    'iOS 17', 'iOS 16', 'iOS 15', 'iOS 14', 'iOS 13'
  ];

  const desktopOS = [
    'Windows 11 Pro', 'Windows 11 Home', 'Windows 10 Pro', 'Windows 10 Home', 'Windows 8.1 Pro',
    'Ubuntu 24.04 LTS', 'Ubuntu 22.04 LTS', 'Ubuntu 20.04 LTS', 'Linux Mint 21', 'Fedora 39',
    'Debian 12', 'Debian 11', 'CentOS 8', 'Red Hat Enterprise Linux 9', 'Arch Linux',
    'Kali Linux 2023', 'Parrot OS', 'Manjaro', 'Elementary OS', 'Zorin OS'
  ];

  const appleOS = [
    'macOS Monterey', 'macOS Ventura', 'macOS Sonoma', 'macOS Big Sur', 'macOS Catalina'
  ];

  if (device.includes('Mac') || device.includes('iMac') || device.includes('Mac Mini')) {
    return randomChoice(appleOS);
  } else if (device.includes('iPhone')) {
    return randomChoice(['iOS 17', 'iOS 16', 'iOS 15', 'iOS 14', 'iOS 13']);
  } else if (isMobileDevice(device)) {
    return randomChoice(mobileOS);
  } else {
    return randomChoice(desktopOS);
  }
}

function fakeBrowser() {
  const browsers = [
    'Chrome 120.0', 'Chrome 119.0', 'Chrome 118.0', 'Chrome 117.0', 'Chrome 116.0',
    'Firefox 121.0', 'Firefox 120.0', 'Firefox 119.0', 'Firefox 118.0', 'Firefox 117.0',
    'Safari 17.0', 'Safari 16.5', 'Safari 16.0', 'Safari 15.6', 'Safari 15.0',
    'Edge 120.0', 'Edge 119.0', 'Edge 118.0', 'Edge 117.0', 'Edge 116.0',
    'Opera 106.0', 'Opera 105.0', 'Opera 104.0', 'Opera 103.0', 'Opera 102.0',
    'Brave 1.60', 'Brave 1.59', 'Brave 1.58', 'Brave 1.57', 'Brave 1.56',
    'Vivaldi 6.5', 'Vivaldi 6.4', 'Vivaldi 6.3', 'Vivaldi 6.2', 'Vivaldi 6.1',
    'Tor Browser 12.0', 'Tor Browser 11.5', 'Tor Browser 11.0', 'Tor Browser 10.5', 'Tor Browser 10.0'
  ];
  return randomChoice(browsers);
}

function fakeDevice() {
  const devices = [
    'Samsung Galaxy S24', 'Samsung Galaxy S23', 'Samsung Galaxy S22', 'Samsung Galaxy Note 20', 'Samsung Galaxy A54',
    'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro',
    'MacBook Pro M3', 'MacBook Air M2', 'MacBook Pro M1', 'iMac 24"', 'Mac Mini M2',
    'Dell XPS 13', 'Dell XPS 15', 'Dell Inspiron 15', 'Dell Latitude 5420', 'Dell Precision 5570',
    'Pixel 8 Pro', 'Pixel 8', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 6a',
    'Lenovo ThinkPad X1', 'Lenovo ThinkPad T14', 'Lenovo Yoga 9i', 'Lenovo Legion 5', 'Lenovo IdeaPad 3',
    'HP Spectre x360', 'HP Envy 13', 'HP Pavilion 15', 'HP EliteBook 840', 'HP Omen 16',
    'Asus ROG Strix G15', 'Asus ZenBook 14', 'Asus VivoBook 15', 'Asus TUF Gaming F15', 'Asus Chromebook Flip',
    'Acer Aspire 5', 'Acer Predator Helios', 'Acer Swift 3', 'Acer Nitro 5', 'Acer Chromebook 514',
    'Sony Xperia 5 IV', 'Sony Xperia 1 IV', 'Sony Xperia 10 IV', 'Sony WH-1000XM5', 'Sony A7 IV',
    'OnePlus 11', 'OnePlus 10 Pro', 'OnePlus Nord N20', 'OnePlus 9', 'OnePlus 8T',
    'Xiaomi 13 Pro', 'Xiaomi 13', 'Xiaomi Redmi Note 12', 'Xiaomi Mi 11', 'Xiaomi Poco X4'
  ];
  return randomChoice(devices);
}

function isMobileDevice(device) {
  const mobileKeywords = ['Galaxy', 'iPhone', 'Pixel', 'Xperia', 'OnePlus', 'Xiaomi', 'Sony Xperia', 'Redmi', 'Poco'];
  return mobileKeywords.some(keyword => device.includes(keyword));
}

function fakeResolution(device) {
  const mobileResolutions = [
    '1080x2400', '1080x2340', '1080x2400', '1170x2532', '1125x2436',
    '1080x1920', '1440x3200', '1440x3120', '1080x2160', '720x1600',
    '1080x2280', '1080x2460', '1440x3040', '1080x2520', '720x1560'
  ];

  const desktopResolutions = [
    '1920x1080', '2560x1440', '3840x2160', '1366x768', '1280x720',
    '1680x1050', '1600x900', '1440x900', '1280x1024', '1024x768',
    '3440x1440', '2560x1080', '1920x1200', '1680x945', '1536x864',
    '5120x1440', '3840x1600', '3200x1800', '2880x1800', '2560x1600'
  ];

  if (isMobileDevice(device)) {
    return randomChoice(mobileResolutions);
  } else {
    return randomChoice(desktopResolutions);
  }
}

function fakeTimezone() {
  const timezones = [
    'UTC-5 (America/Bogota)', 'UTC-3 (America/Buenos_Aires)', 'UTC+1 (Europe/Madrid)', 'UTC-6 (America/Mexico_City)',
    'UTC-4 (America/Caracas)', 'UTC-3 (America/Santiago)', 'UTC-5 (America/Lima)', 'UTC-6 (America/Guatemala)',
    'UTC-6 (America/El_Salvador)', 'UTC-6 (America/Managua)', 'UTC-6 (America/Tegucigalpa)',
    'UTC-6 (America/Costa_Rica)', 'UTC-5 (America/Panama)', 'UTC-4 (America/Asuncion)',
    'UTC-4 (America/La_Paz)', 'UTC-3 (America/Montevideo)', 'UTC-4 (America/Santo_Domingo)',
    'UTC-5 (America/Havana)', 'UTC+2 (Europe/Paris)', 'UTC+1 (Europe/London)',
    'UTC+3 (Europe/Moscow)', 'UTC+8 (Asia/Shanghai)', 'UTC+9 (Asia/Tokyo)',
    'UTC-8 (America/Los_Angeles)', 'UTC-5 (America/New_York)', 'UTC-3 (America/Sao_Paulo)',
    'UTC+5:30 (Asia/Kolkata)', 'UTC+7 (Asia/Bangkok)', 'UTC+10 (Australia/Sydney)',
    'UTC+12 (Pacific/Auckland)', 'UTC-10 (Pacific/Honolulu)', 'UTC+0 (UTC)'
  ];
  return randomChoice(timezones);
}

function fakeVPN() {
  return randomChoice(['Active','Inactive','Detected','Bypassed']);
}

function fakeFirewall() {
  return randomChoice(['Enabled','Disabled','Bypassed']);
}

function fakeAntivirus() {
  const avs = [
    'Windows Defender', 'Avast', 'Kaspersky', 'Norton', 'McAfee', 'None',
    'Bitdefender', 'ESET NOD32', 'AVG', 'Avira', 'Malwarebytes',
    'Sophos', 'Trend Micro', 'Panda Security', 'F-Secure', 'Comodo',
    'BullGuard', 'ZoneAlarm', 'G Data', 'VIPRE', 'Webroot',
    'Emsisoft', 'Fortinet', 'ClamAV', 'Dr.Web', '360 Total Security'
  ];
  return randomChoice(avs);
}

function fakeCPU(device) {
  const mobileCPUs = [
    'Qualcomm Snapdragon 8 Gen 3', 'Qualcomm Snapdragon 8 Gen 2', 'Qualcomm Snapdragon 888', 'Qualcomm Snapdragon 865', 'Qualcomm Snapdragon 855',
    'Samsung Exynos 2200', 'Samsung Exynos 2100', 'Samsung Exynos 990', 'Samsung Exynos 2100', 'Samsung Exynos 1280',
    'Apple A16 Bionic', 'Apple A15 Bionic', 'Apple A14 Bionic', 'Apple A13 Bionic', 'Apple A12 Bionic',
    'MediaTek Dimensity 9200', 'MediaTek Dimensity 9000', 'MediaTek Dimensity 8100', 'MediaTek Dimensity 8000', 'MediaTek Dimensity 7200',
    'Google Tensor G3', 'Google Tensor G2', 'Google Tensor G1', 'Kirin 9000', 'Kirin 990'
  ];

  const desktopCPUs = [
    'Intel Core i7-13700K', 'Intel Core i9-13900K', 'Intel Core i5-13600K', 'Intel Core i3-13100', 'Intel Core i7-12700K',
    'AMD Ryzen 9 7950X', 'AMD Ryzen 7 7800X3D', 'AMD Ryzen 5 7600X', 'AMD Ryzen 9 5900X', 'AMD Ryzen 7 5800X3D',
    'AMD Ryzen 5 5600G', 'Intel Celeron N5100', 'AMD Athlon 3000G', 'Intel Core i5-12400', 'AMD Ryzen 5 5600',
    'Intel Core i3-12100', 'AMD Ryzen 3 3200G', 'Intel Pentium Gold G6400', 'AMD Ryzen 5 3400G', 'Intel Core i7-10700K'
  ];

  const appleCPUs = [
    'Apple M3', 'Apple M2', 'Apple M1', 'Apple M1 Pro', 'Apple M1 Max'
  ];

  if (device.includes('Mac') || device.includes('iMac') || device.includes('Mac Mini')) {
    return randomChoice(appleCPUs);
  } else if (isMobileDevice(device)) {
    return randomChoice(mobileCPUs);
  } else {
    return randomChoice(desktopCPUs);
  }
}

function fakeGPU(device) {
  const mobileGPUs = [
    'Qualcomm Adreno 740', 'Qualcomm Adreno 730', 'Qualcomm Adreno 660', 'Qualcomm Adreno 650', 'Qualcomm Adreno 640',
    'Samsung Xclipse 920', 'Samsung Xclipse 530', 'Samsung Xclipse 410', 'Samsung Mali-G78', 'Samsung Mali-G77',
    'Apple A16 Bionic GPU', 'Apple A15 Bionic GPU', 'Apple A14 Bionic GPU', 'Apple A13 Bionic GPU', 'Apple A12 Bionic GPU',
    'MediaTek Mali-G710', 'MediaTek Mali-G78', 'MediaTek Mali-G77', 'MediaTek Mali-G76', 'MediaTek Mali-G68',
    'ARM Mali-G78', 'ARM Mali-G77', 'ARM Mali-G76', 'ARM Mali-G68', 'ARM Mali-G57',
    'PowerVR GE8320', 'Imagination BXM-8-256', 'Vivante GC7000', 'Vivante GC5200', 'NVIDIA Tegra X1'
  ];

  const desktopGPUs = [
    'NVIDIA RTX 4080', 'NVIDIA RTX 4070', 'NVIDIA RTX 4060', 'NVIDIA RTX 3090', 'NVIDIA RTX 3080',
    'AMD Radeon RX 7900 XT', 'AMD Radeon RX 7800 XT', 'AMD Radeon RX 7700 XT', 'AMD Radeon RX 6800 XT', 'AMD Radeon RX 6700 XT',
    'NVIDIA GTX 1660 Ti', 'NVIDIA GTX 1650', 'AMD Radeon RX 6600', 'AMD Radeon RX 6500 XT', 'NVIDIA RTX 3060',
    'Intel Iris Xe', 'Intel UHD Graphics 770', 'Intel UHD Graphics 630', 'AMD Radeon RX 580', 'NVIDIA GTX 1050 Ti',
    'NVIDIA RTX 2060', 'AMD Radeon RX 5700 XT', 'NVIDIA GTX 1070', 'AMD Radeon RX 5600 XT', 'NVIDIA RTX 3050'
  ];

  const appleGPUs = [
    'Apple M3 GPU', 'Apple M2 GPU', 'Apple M1 GPU', 'Apple M1 Pro GPU', 'Apple M1 Max GPU'
  ];

  if (device.includes('Mac') || device.includes('iMac') || device.includes('Mac Mini')) {
    return randomChoice(appleGPUs);
  } else if (isMobileDevice(device)) {
    return randomChoice(mobileGPUs);
  } else {
    return randomChoice(desktopGPUs);
  }
}

function fakeRAM(device) {
  if (isMobileDevice(device)) {
    return `${randomInt(4,16)} GB`;
  } else {
    return `${randomInt(8,128)} GB`;
  }
}

function fakeStorage(device) {
  if (isMobileDevice(device)) {
    return `${randomInt(64,512)} GB`;
  } else {
    return `${randomInt(256,4096)} GB SSD`;
  }
}

function fakeLeakScore() {
  return `${randomInt(1,100)}%`;
}

function fakeGPS() {
  const lat = (randomInt(-90000000, 90000000) / 1000000).toFixed(6);
  const lon = (randomInt(-180000000, 180000000) / 1000000).toFixed(6);
  return `${lat}, ${lon}`;
}

function fakePostalCode() {
  return `${randomInt(10000, 99999)}`;
}

function fakeConnectionSpeed() {
  return `${randomInt(10, 1000)} Mbps`;
}

function fakeBankAccount() {
  const banks = [
    'Banco Nacional', 'Banco Central', 'Banco Internacional', 'FinTech Bank', 'Banco de Crédito',
    'BBVA Colombia', 'Bancolombia', 'Davivienda', 'Banco de Bogotá', 'Banco Popular',
    'Banco de Crédito del Perú', 'BBVA Perú', 'Interbank Perú', 'Scotiabank Perú', 'Banco Pichincha Perú',
    'BBVA España', 'Santander España', 'CaixaBank España', 'Bankia España', 'Sabadell España',
    'BBVA México', 'Santander México', 'Banamex México', 'Banorte México', 'HSBC México',
    'BBVA Argentina', 'Santander Argentina', 'Banco Nación Argentina', 'Banco Provincia Argentina', 'ICBC Argentina',
    'Banco Estado Chile', 'BBVA Chile', 'Santander Chile', 'Banco de Chile', 'BCI Chile',
    'Banco Pichincha Ecuador', 'Banco Guayaquil Ecuador', 'Banco del Pacífico Ecuador', 'Produbanco Ecuador', 'Banco Internacional Ecuador',
    'Banesco Venezuela', 'Mercantil Venezuela', 'Banco de Venezuela', 'Provincial Venezuela', 'Exterior Venezuela',
    'Banco General Panamá', 'Banistmo Panamá', 'Global Bank Panamá', 'Multibank Panamá', 'Banco Nacional de Panamá'
  ];
  const account = `${randomInt(1000000000, 9999999999)}`;
  return `${randomChoice(banks)} - ${account}`;
}

function fakeBalance() {
  return `$${randomInt(1000, 100000).toLocaleString()}`;
}

function fakeSocialMedia() {
  const platforms = [
    'Twitter', 'Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Snapchat', 'YouTube', 'Reddit', 'Discord', 'Twitch',
    'Pinterest', 'Tumblr', 'Flickr', 'Vimeo', 'Dailymotion', 'Viber', 'WhatsApp', 'Telegram', 'Signal', 'WeChat'
  ];
  const handles = [
    '@user_pro', '@cool_guy', '@tech_nerd', '@random_user', '@social_butterfly',
    '@digital_nomad', '@code_master', '@art_lover', '@music_fan', '@travel_bug',
    '@foodie_adventures', '@fitness_guru', '@bookworm', '@gamer_pro', '@photographer',
    '@designer_life', '@entrepreneur', '@student_life', '@parenting', '@pet_lover'
  ];
  return `${randomChoice(platforms)}: ${randomChoice(handles)}`;
}

function fakeJob() {
  const jobs = [
    'Software Engineer', 'Data Analyst', 'Marketing Manager', 'Teacher', 'Doctor', 'Lawyer', 'Designer',
    'Project Manager', 'Sales Representative', 'Customer Service', 'Accountant', 'Nurse', 'Chef', 'Driver',
    'Electrician', 'Plumber', 'Mechanic', 'Carpenter', 'Painter', 'Security Guard', 'Waiter', 'Bartender',
    'Journalist', 'Photographer', 'Videographer', 'Graphic Designer', 'Web Developer', 'UX Designer', 'Data Scientist',
    'DevOps Engineer', 'System Administrator', 'Network Engineer', 'Cybersecurity Analyst', 'Product Manager',
    'Business Analyst', 'Financial Advisor', 'Real Estate Agent', 'Insurance Agent', 'Pharmacist', 'Dentist',
    'Veterinarian', 'Architect', 'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Chemical Engineer'
  ];
  const companies = [
    'Tech Corp', 'Global Inc', 'Innovate Ltd', 'Future Systems', 'Digital Solutions',
    'MegaCorp', 'StartUp Hub', 'Enterprise Solutions', 'NextGen Tech', 'Smart Systems',
    'DataFlow Inc', 'CloudTech', 'AI Solutions', 'BlockChain Ltd', 'FinTech Innovations',
    'HealthCare Plus', 'EduTech Academy', 'Green Energy Corp', 'AutoMotive Inc', 'Retail Giant',
    'Media Group', 'Entertainment Corp', 'Sports Network', 'Travel Agency', 'Food Chain'
  ];
  return `${randomChoice(jobs)} at ${randomChoice(companies)}`;
}

function fakeEducation() {
  const degrees = [
    'Bachelor in Computer Science', 'Master in Business', 'PhD in Engineering', 'Associate Degree', 'High School Diploma',
    'Bachelor in Business Administration', 'Master in Computer Science', 'PhD in Physics', 'Bachelor in Medicine', 'Master in Law',
    'Bachelor in Psychology', 'Master in Education', 'PhD in Chemistry', 'Bachelor in Economics', 'Master in Marketing',
    'Bachelor in Art', 'Master in Fine Arts', 'PhD in Mathematics', 'Bachelor in Nursing', 'Master in Public Health',
    'Bachelor in Architecture', 'Master in Civil Engineering', 'PhD in Biology', 'Bachelor in Journalism', 'Master in Communications',
    'Bachelor in Environmental Science', 'Master in Data Science', 'PhD in History', 'Bachelor in Sociology', 'Master in Philosophy'
  ];
  const schools = [
    'University of Tech', 'State College', 'National Academy', 'Online University', 'Global Institute',
    'Harvard University', 'MIT', 'Stanford University', 'Oxford University', 'Cambridge University',
    'University of Buenos Aires', 'UNAM Mexico', 'University of São Paulo', 'University of Chile', 'Pontificia Universidad Católica',
    'Universidad de los Andes', 'Universidad Nacional de Colombia', 'Universidad de Lima', 'ITESM Mexico', 'Universidad de Palermo',
    'Technical University', 'Business School', 'Art Academy', 'Medical School', 'Law School'
  ];
  return `${randomChoice(degrees)} from ${randomChoice(schools)}`;
}

function fakeVehicle() {
  const makes = [
    'Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes', 'Tesla', 'Chevrolet', 'Nissan', 'Volkswagen', 'Audi',
    'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Lexus', 'Acura', 'Infiniti', 'Lincoln', 'Cadillac', 'GMC',
    'Jeep', 'Dodge', 'Chrysler', 'Ram', 'Fiat', 'Peugeot', 'Renault', 'Citroën', 'Volvo', 'Saab'
  ];
  const models = [
    'Corolla', 'Civic', 'Mustang', 'X5', 'C-Class', 'Model 3', 'Cruze', 'Altima', 'Golf', 'A4',
    'Elantra', 'Sportage', 'Mazda3', 'Outback', 'RX', 'TLX', 'Q50', 'Navigator', 'Escalade', 'Yukon',
    'Wrangler', 'Charger', '300', '1500', '500', '308', 'Clio', 'C4', 'XC90', '9-3'
  ];
  const year = randomInt(2010, 2024);
  const plate = `${randomChoice(['ABC', 'XYZ', 'DEF', 'GHI', 'JKL', 'MNO', 'PQR', 'STU', 'VWX', 'YZA'])}${randomInt(100, 999)}`;
  return `${year} ${randomChoice(makes)} ${randomChoice(models)} - Plate: ${plate}`;
}

function fakeHealth() {
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const height = `${randomInt(150, 200)} cm`;
  const weight = `${randomInt(50, 100)} kg`;
  return `Blood Type: ${randomChoice(bloodTypes)}, Height: ${height}, Weight: ${weight}`;
}

function fakeFamily() {
  const relations = [
    'Father: John Doe', 'Mother: Jane Smith', 'Brother: Mike', 'Sister: Anna',
    'Father: Carlos Rodriguez', 'Mother: Maria Gonzalez', 'Brother: David', 'Sister: Laura',
    'Father: Roberto Martinez', 'Mother: Ana Lopez', 'Brother: Juan', 'Sister: Sofia',
    'Father: Miguel Hernandez', 'Mother: Carmen Garcia', 'Brother: Alejandro', 'Sister: Isabella',
    'Father: Jose Perez', 'Mother: Rosa Sanchez', 'Brother: Diego', 'Sister: Valentina',
    'Father: Antonio Ramirez', 'Mother: Lucia Torres', 'Brother: Mateo', 'Sister: Camila',
    'Father: Francisco Flores', 'Mother: Elena Morales', 'Brother: Lucas', 'Sister: Martina',
    'Father: Luis Ruiz', 'Mother: Patricia Diaz', 'Brother: Sebastian', 'Sister: Emma',
    'Father: Pedro Jimenez', 'Mother: Silvia Alvarez', 'Brother: Nicolas', 'Sister: Zoe',
    'Father: Angel Moreno', 'Mother: Monica Castro', 'Brother: Samuel', 'Sister: Luna'
  ];
  return randomChoice(relations);
}

function fakePassport() {
  const countries = [
    'Colombia', 'Peru', 'Mexico', 'Spain', 'Argentina', 'Chile', 'Ecuador', 'Venezuela', 'Panama', 'Uruguay',
    'Paraguay', 'Bolivia', 'Costa Rica', 'Honduras', 'Guatemala', 'El Salvador', 'Nicaragua', 'Belize', 'Brazil',
    'United States', 'Canada', 'United Kingdom', 'France', 'Germany', 'Italy', 'Netherlands', 'Belgium', 'Switzerland',
    'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Greece', 'Poland', 'Czech Republic',
    'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Slovakia', 'Estonia', 'Latvia', 'Lithuania'
  ];
  const number = `${randomChoice(['P', 'A', 'C', 'D', 'E', 'F'])}${randomInt(1000000, 9999999)}`;
  return `${number} (${randomChoice(countries)})`;
}

function fakeBrowsingHistory() {
  const adultSites = [
    'pornhub[.com]', 'xvideos[.com]', 'xhamster[.com]', 'redtube[.com]', 'youporn[.com]',
    'tube8[.com]', 'spankwire[.com]', 'keezmovies[.com]', 'extremetube[.com]', 'tnaflix[.com]',
    'bangbros[.com]', 'realitykings[.com]', 'naughtyamerica[.com]', 'brazzers[.com]', 'digitalplayground[.com]',
    'evilangel[.com]', 'blacked[.com]', 'tushy[.com]', 'vixen[.com]', 'legalporno[.com]',
    'beeg[.com]', 'porn300[.com]', 'wetpussy[.com]', 'freesexvideos[.com]', 'hotsex[.com]',
    'adultfriendfinder[.com]', 'flingster[.com]', 'chaturbate[.com]', 'myfreecams[.com]', 'bonga[.com]',
    'camgirls[.com]', 'stripchat[.com]', 'onlyfans[.com]', 'manyvids[.com]', 'justforfans[.com]',
    'sexshop[.com]', 'adamandeve[.com]', 'lovehoney[.com]', 'bad-dragon[.com]', 'shevibe[.com]',
    'nudevista[.com]', 'nudemodels[.com]', 'suicidegirls[.com]', 'playboy[.com]', 'penthouse[.com]',
    'maxim[.com]', 'fhm[.com]', 'stuff[.com]', 'cosmopolitan[.com]', 'menshealth[.com]'
  ];
  
  const normalSites = [
    'www.google.com', 'www.youtube.com', 'www.facebook.com', 'www.instagram.com', 'www.twitter.com',
    'www.netflix.com', 'www.amazon.com', 'www.wikipedia.org', 'www.reddit.com', 'www.tiktok.com',
    'www.whatsapp.com', 'www.spotify.com', 'www.github.com', 'www.stackoverflow.com', 'www.medium.com'
  ];
  
  const history = [];
  const numSites = randomInt(5, 10);
  
  for (let i = 0; i < numSites; i++) {
    if (randomInt(1, 10) <= 7) { // 70% chance of adult site for humor
      history.push(randomChoice(adultSites));
    } else {
      history.push(randomChoice(normalSites));
    }
  }
  
  return history.slice(0, 8).join('\n├─ '); // Limit to 8 sites
}

export async function doxCommand(sock, msg, isAdmin, groupMetadata) {
  try {
    const chatId = msg.key.remoteJid;
    const from = msg.key.participant || chatId;

    // Determinar objetivo: prioridad reply > mención > quien invoca
    let targetJid = null;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (ctx?.quotedMessage) {
      targetJid = ctx.participant || ctx?.quotedMessage?.participant || null;
    }
    if (!targetJid && ctx?.mentionedJid && ctx.mentionedJid.length) {
      targetJid = ctx.mentionedJid[0];
    }
    if (!targetJid) targetJid = from;

    // Normalizar JID (si viene con @s.whatsapp.net o formatos distintos)
    if (typeof targetJid === 'string' && !targetJid.includes('@')) targetJid = `${targetJid}@s.whatsapp.net`;

    // Obtener nombre mostrable
    const displayName = msg.pushName || (targetJid.split && targetJid.split('@')[0]) || 'usuario';

    // Generar datos falsos
    const ipv4 = randomIPv4();
    const ipv6 = randomIPv6();
    const mac = randomMAC();
    const email = fakeEmailFromName(displayName);
    const phone = fakePhone();
    const location = fakeLocation();
    const isp = fakeISP();
    const device = fakeDevice();
    const os = fakeOS(device);
    const browser = fakeBrowser();
    const resolution = fakeResolution(device);
    const timezone = fakeTimezone();
    const vpn = fakeVPN();
    const firewall = fakeFirewall();
    const antivirus = fakeAntivirus();
    const cpu = fakeCPU(device);
    const gpu = fakeGPU(device);
    const ram = fakeRAM(device);
    const storage = fakeStorage(device);
    const leakScore = fakeLeakScore();
    const gps = fakeGPS();
    const postalCode = fakePostalCode();
    const connectionSpeed = fakeConnectionSpeed();
    const bankAccount = fakeBankAccount();
    const balance = fakeBalance();
    const socialMedia = fakeSocialMedia();
    const job = fakeJob();
    const education = fakeEducation();
    const vehicle = fakeVehicle();
    const health = fakeHealth();
    const family = fakeFamily();
    const passport = fakePassport();
    const browsingHistory = fakeBrowsingHistory();

    const lines = [];
    lines.push('🔥 HACKED DATA DUMP 🔥');
    lines.push('────────────────────────────────');
    lines.push(`👤 Target: @${targetJid.split('@')[0]}`);
    lines.push(`📍 Location: ${location} (${postalCode})`);
    lines.push(`📌 GPS: ${gps}`);
    lines.push('');
    lines.push('🌐 NETWORK INFO');
    lines.push(`├─ IP (v4): ${ipv4}`);
    lines.push(`├─ IP (v6): ${ipv6}`);
    lines.push(`├─ MAC: ${mac}`);
    lines.push(`├─ ISP: ${isp}`);
    lines.push(`├─ Connection Speed: ${connectionSpeed}`);
    lines.push(`└─ Timezone: ${timezone}`);
    lines.push('');
    lines.push('💻 DEVICE INFO');
    lines.push(`├─ OS: ${os}`);
    lines.push(`├─ Browser: ${browser}`);
    lines.push(`├─ Device: ${device}`);
    lines.push(`├─ Resolution: ${resolution}`);
    lines.push(`├─ CPU: ${cpu}`);
    lines.push(`├─ GPU: ${gpu}`);
    lines.push(`├─ RAM: ${ram}`);
    lines.push(`└─ Storage: ${storage}`);
    lines.push('');
    lines.push('🔒 SECURITY INFO');
    lines.push(`├─ VPN: ${vpn}`);
    lines.push(`├─ Firewall: ${firewall}`);
    lines.push(`├─ Antivirus: ${antivirus}`);
    lines.push(`└─ Leak Score: ${leakScore}`);
    lines.push('');
    lines.push('💰 FINANCIAL INFO');
    lines.push(`├─ Bank Account: ${bankAccount}`);
    lines.push(`└─ Balance: ${balance}`);
    lines.push('');
    lines.push('📱 SOCIAL MEDIA');
    lines.push(`└─ ${socialMedia}`);
    lines.push('');
    lines.push('🌐 BROWSING HISTORY (Recent Sites)');
    lines.push(`├─ ${browsingHistory}`);
    lines.push('');
    lines.push('💼 PROFESSIONAL INFO');
    lines.push(`├─ Job: ${job}`);
    lines.push(`└─ Education: ${education}`);
    lines.push('');
    lines.push('🚗 VEHICLE INFO');
    lines.push(`└─ ${vehicle}`);
    lines.push('');
    lines.push('🏥 HEALTH INFO');
    lines.push(`└─ ${health}`);
    lines.push('');
    lines.push('👨‍👩‍👧‍👦 FAMILY INFO');
    lines.push(`└─ ${family}`);
    lines.push('');
    lines.push('🛂 IDENTIFICATION');
    lines.push(`├─ Passport: ${passport}`);
    lines.push(`├─ Phone: ${phone}`);
    lines.push(`└─ Email: ${email}`);
    lines.push('────────────────────────────────');
    lines.push('Have fun hacking!');

    const text = lines.join('\n');

    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, { text, mentions: [targetJid] }, { quoted: msg });

  } catch (error) {
    console.error('Error en comando !dox:', error);
    const chatId = msg.key.remoteJid;
    await sock.sendMessage(chatId, { text: '⚠️ Error executing !dox.' }, { quoted: msg });
  }
}
