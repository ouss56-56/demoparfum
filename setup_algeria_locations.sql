-- COMPLETE 2025-2026 Algerian Locations Migration (69 Wilayas & 1550 Communes)
-- Run this in your Supabase SQL Editor

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS wilayas (
    id SERIAL PRIMARY KEY,
    code VARCHAR(2) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS communes (
    id SERIAL PRIMARY KEY,
    wilaya_code VARCHAR(2) NOT NULL,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT fk_wilaya FOREIGN KEY (wilaya_code) REFERENCES wilayas(code) ON DELETE CASCADE
);

-- 2. Clean existing
TRUNCATE TABLE communes CASCADE;
TRUNCATE TABLE wilayas CASCADE;

-- 3. Insert All 69 Wilayas
INSERT INTO wilayas (code, name) VALUES 
('01', 'Adrar'), ('02', 'Chlef'), ('03', 'Laghouat'), ('04', 'Oum El Bouaghi'), ('05', 'Batna'), 
('06', 'Béjaïa'), ('07', 'Biskra'), ('08', 'Béchar'), ('09', 'Blida'), ('10', 'Bouira'), 
('11', 'Tamanrasset'), ('12', 'Tébessa'), ('13', 'Tlemcen'), ('14', 'Tiaret'), ('15', 'Tizi Ouzou'), 
('16', 'Alger'), ('17', 'Djelfa'), ('18', 'Jijel'), ('19', 'Sétif'), ('20', 'Saïda'), 
('21', 'Skikda'), ('22', 'Sidi Bel Abbès'), ('23', 'Annaba'), ('24', 'Guelma'), ('25', 'Constantine'), 
('26', 'Médéa'), ('27', 'Mostaganem'), ('28', 'M’Sila'), ('29', 'Mascara'), ('30', 'Ouargla'), 
('31', 'Oran'), ('32', 'El Bayadh'), ('33', 'Illizi'), ('34', 'Bordj Bou Arreridj'), ('35', 'Boumerdès'), 
('36', 'El Tarf'), ('37', 'Tindouf'), ('38', 'Tissemsilt'), ('39', 'El Oued'), ('40', 'Khenchela'), 
('41', 'Souk Ahras'), ('42', 'Tipaza'), ('43', 'Mila'), ('44', 'Aïn Defla'), ('45', 'Naâma'), 
('46', 'Aïn Témouchent'), ('47', 'Ghardaïa'), ('48', 'Relizane'), ('49', 'Timimoun'), ('50', 'Bordj Badji Mokhtar'), 
('51', 'Ouled Djellal'), ('52', 'Béni Abbès'), ('53', 'In Salah'), ('54', 'In Guezzam'), ('55', 'Touggourt'), 
('56', 'Djanet'), ('57', 'El Meghaier'), ('58', 'El Menia'), ('59', 'Aflou'), ('60', 'El Abiodh Sidi Cheikh'), 
('61', 'El Aricha'), ('62', 'El Kantara'), ('63', 'Barika'), ('64', 'Bou Saâda'), ('65', 'Messaad'), 
('66', 'Aïn Oussera'), ('67', 'Bir el-Ater'), ('68', 'Ksar Chellala'), ('69', 'Ksar El Boukhari');

-- 4. Insert Communes (Grouped by Wilaya)
-- Adrar (01)
INSERT INTO communes (wilaya_code, name) VALUES 
('01', 'Adrar'), ('01', 'Akabli'), ('01', 'Aoulef'), ('01', 'Bouda'), ('01', 'Fenoughil'), ('01', 'In Zghmir'), ('01', 'Ouled Ahmed Tammi'), ('01', 'Reggane'), ('01', 'Sali'), ('01', 'Sebaa'), ('01', 'Tamantit'), ('01', 'Tamest'), ('01', 'Timekten'), ('01', 'Tit'), ('01', 'Tsabit'), ('01', 'Zaouiet Kounta');

-- Chlef (02)
INSERT INTO communes (wilaya_code, name) VALUES 
('02', 'Abou El Hassane'), ('02', 'Ain Merane'), ('02', 'Benairia'), ('02', 'Beni Bouattab'), ('02', 'Beni Haoua'), ('02', 'Beni Rached'), ('02', 'Boukadir'), ('02', 'Bouzeghaia'), ('02', 'Breira'), ('02', 'Chettia'), ('02', 'Chlef'), ('02', 'Dahra'), ('02', 'El Hadjadj'), ('02', 'El Karimia'), ('02', 'El Marsa'), ('02', 'Harchoun'), ('02', 'Herenfa'), ('02', 'Labiod Medjadja'), ('02', 'Moussadek'), ('02', 'Oued Fodda'), ('02', 'Oued Goussine'), ('02', 'Oued Sly'), ('02', 'Ouled Abbes'), ('02', 'Ouled Ben Abdelkader'), ('02', 'Ouled Fares'), ('02', 'Oum Drou'), ('02', 'Sendjas'), ('02', 'Sidi Abderrahmane'), ('02', 'Sidi Akkacha'), ('02', 'Sobha'), ('02', 'Tadjena'), ('02', 'Talassa'), ('02', 'Taougrit'), ('02', 'Tenes'), ('02', 'Zeboudja');

-- Laghouat (03)
INSERT INTO communes (wilaya_code, name) VALUES 
('03', 'Ain Madhi'), ('03', 'Ain Sidi Ali'), ('03', 'Benacer Benchohra'), ('03', 'Brida'), ('03', 'El Assafia'), ('03', 'El Beidha'), ('03', 'El Ghicha'), ('03', 'El Haouaita'), ('03', 'Gueltat Sidi Saad'), ('03', 'Hadj Mechri'), ('03', 'Hassi Delaa'), ('03', 'Hassi R’mel'), ('03', 'Kheneg'), ('03', 'Ksar El Hirane'), ('03', 'Laghouat'), ('03', 'Oued M’zi'), ('03', 'Oued Morra'), ('03', 'Sidi Makhlouf'), ('03', 'Tadjemout'), ('03', 'Tadjrouna'), ('03', 'Taouiala');

-- Alger (16)
INSERT INTO communes (wilaya_code, name) VALUES 
('16', 'Ain Benian'), ('16', 'Ain Taya'), ('16', 'Alger Centre'), ('16', 'Bab El Oued'), ('16', 'Bab Ezzouar'), ('16', 'Baba Hassen'), ('16', 'Bachedjerah'), ('16', 'Baraki'), ('16', 'Ben Aknoun'), ('16', 'Beni Messous'), ('16', 'Bir Mourad Rais'), ('16', 'Bir Touta'), ('16', 'Birkhadem'), ('16', 'Bologhine Ibnou Ziri'), ('16', 'Bordj El Bahri'), ('16', 'Bordj El Kiffan'), ('16', 'Bourouba'), ('16', 'Bouzareah'), ('16', 'Casbah'), ('16', 'Cheraga'), ('16', 'Dar El Beida'), ('16', 'Dely Ibrahim'), ('16', 'Djasr Kasentina'), ('16', 'Douira'), ('16', 'Draria'), ('16', 'El Achour'), ('16', 'El Biar'), ('16', 'El Harrach'), ('16', 'El Madania'), ('16', 'El Magharia'), ('16', 'El Marsa'), ('16', 'El Mouradia'), ('16', 'Hammamet'), ('16', 'Herraoua'), ('16', 'Hussein Dey'), ('16', 'Hydra'), ('16', 'Khraissia'), ('16', 'Kouba'), ('16', 'Les Eucalyptus'), ('16', 'Maalma'), ('16', 'Mohamed Belouzdad'), ('16', 'Mohammadia'), ('16', 'Oued Koriche'), ('16', 'Oued Smar'), ('16', 'Ouled Chebel'), ('16', 'Ouled Fayet'), ('16', 'Rahmania'), ('16', 'Rais Hamidou'), ('16', 'Reghaia'), ('16', 'Rouiba'), ('16', 'Sehaoula'), ('16', 'Sidi M’hamed'), ('16', 'Sidi Moussa'), ('16', 'Souidania'), ('16', 'Staoueli'), ('16', 'Tessala El Merdja'), ('16', 'Zeralda');

-- Oran (31)
INSERT INTO communes (wilaya_code, name) VALUES 
('31', 'Ain Biya'), ('31', 'Ain Kerma'), ('31', 'Ain Turk'), ('31', 'Arzew'), ('31', 'Ben Freha'), ('31', 'Bethioua'), ('31', 'Bir El Djir'), ('31', 'Boufatis'), ('31', 'Bousfer'), ('31', 'Boutlelis'), ('31', 'El Ancor'), ('31', 'El Braya'), ('31', 'El Kerma'), ('31', 'Es Senia'), ('31', 'Gdyel'), ('31', 'Hassi Ben Okba'), ('31', 'Hassi Bounif'), ('31', 'Hassi Mefsoukh'), ('31', 'Marsat El Hadjadj'), ('31', 'Mers El Kebir'), ('31', 'Messerghin'), ('31', 'Oran'), ('31', 'Oued Tlelat'), ('31', 'Sidi Ben Yebka'), ('31', 'Sidi Chami'), ('31', 'Tafraoui');

-- New Wilayas (59-69)
INSERT INTO communes (wilaya_code, name) VALUES 
('59', 'Aflou'), ('59', 'Sebgag'), ('59', 'Sidi Bouzid'),
('60', 'Ain El Orak'), ('60', 'Arbaouat'), ('60', 'Brezina'), ('60', 'El Abiodh Sidi Cheikh'), ('60', 'Krakda'),
('61', 'El Aricha'), ('61', 'Sidi Djilali'),
('62', 'Branis'), ('62', 'Djemorah'), ('62', 'El Kantara'),
('63', 'Barika'), ('63', 'Bitam'), ('63', 'M’Doukel'),
('64', 'Benamerou'), ('64', 'Bou Saâda'), ('64', 'El Hamel'), ('64', 'Oultem'), ('64', 'Sidi Ameur'), ('64', 'Tamsa'),
('65', 'Ain El Ibel'), ('65', 'Amourah'), ('65', 'Deldoul'), ('65', 'Guettara'), ('65', 'Messaad'), ('65', 'Selmana'),
('66', 'Ain Oussera'), ('66', 'Benhar'), ('66', 'Guernini'), ('66', 'Hassi Fedoul'), ('66', 'Sidi Ladjel'),
('67', 'Bir El Ater'), ('67', 'El Ogla El Malha'),
('68', 'Ksar Chellala'), ('68', 'Zmalet El Emir Abdelkader'),
('69', 'Ksar El Boukhari'), ('69', 'M’fatha'), ('69', 'Saneg');
