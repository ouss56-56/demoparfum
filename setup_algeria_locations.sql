-- Algerian Locations Migration (Wilayas & Communes)
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

-- 3. Insert Wilayas
INSERT INTO wilayas (code, name) VALUES 
('01', 'Adrar'), ('02', 'Chlef'), ('03', 'Laghouat'), ('04', 'Oum El Bouaghi'), ('05', 'Batna'), 
('06', 'Béjaïa'), ('07', 'Biskra'), ('08', 'Bechar'), ('09', 'Blida'), ('10', 'Bouira'), 
('11', 'Tamanrasset'), ('12', 'Tbessa'), ('13', 'Tlemcen'), ('14', 'Tiaret'), ('15', 'Tizi Ouzou'), 
('16', 'Alger'), ('17', 'Djelfa'), ('18', 'Jijel'), ('19', 'Se9tif'), ('20', 'Saefda'), 
('21', 'Skikda'), ('22', 'Sidi Bel Abbes'), ('23', 'Annaba'), ('24', 'Guelma'), ('25', 'Constantine'), 
('26', 'Medea'), ('27', 'Mostaganem'), ('28', 'M''Sila'), ('29', 'Mascara'), ('30', 'Ouargla'), 
('31', 'Oran'), ('32', 'El Bayadh'), ('33', 'Illizi'), ('34', 'Bordj Bou Arreridj'), ('35', 'Boumerdes'), 
('36', 'El Tarf'), ('37', 'Tindouf'), ('38', 'Tissemsilt'), ('39', 'El Oued'), ('40', 'Khenchela'), 
('41', 'Souk Ahras'), ('42', 'Tipaza'), ('43', 'Mila'), ('44', 'Ain Defla'), ('45', 'Naama'), 
('46', 'Ain Temouchent'), ('47', 'Ghardaefa'), ('48', 'Relizane'), ('49', 'El M''ghair'), ('50', 'El Menia'), 
('51', 'Ouled Djellal'), ('52', 'Bordj Baji Mokhtar'), ('53', 'Béni Abbès'), ('54', 'Timimoun'), ('55', 'Touggourt'), 
('56', 'Djanet'), ('57', 'In Salah'), ('58', 'In Guezzam');

-- 4. Insert Communes
INSERT INTO communes (wilaya_code, name) VALUES 
('01', 'Adrar'), ('01', 'Tamest'), ('01', 'Charouine'), ('01', 'Reggane'), ('01', 'In Zghmir'), ('01', 'Tit'), ('01', 'Ksar Kaddour'), ('01', 'Tsabit'), ('01', 'Timimoun'), ('01', 'Ouled Said'), ('01', 'Zaouiet Kounta'), ('01', 'Aoulef'), ('01', 'Timokten'), ('01', 'Tamentit'), ('01', 'Fenoughil'), ('01', 'Tinerkouk'), ('01', 'Deldoul'), ('01', 'Sali'), ('01', 'Akabli'), ('01', 'Metarfa'), ('01', 'Ouled Ahmed Tammi'), ('01', 'Bouda'), ('01', 'Aougrout'), ('01', 'Talmine'), ('01', 'Bordj Badji Mokhtar'), ('01', 'Sbaa'), ('01', 'Ouled Aissa'), ('01', 'Timiaouine'),
('02', 'Chlef'), ('02', 'Tenes'), ('02', 'Benairia'), ('02', 'El Karimia'), ('02', 'Tadjna'), ('02', 'Taougrite'), ('02', 'Beni Haoua'), ('02', 'Sobha'), ('02', 'Harchoun'), ('02', 'Ouled Fares'), ('02', 'Sidi Akacha'), ('02', 'Boukadir'), ('02', 'Beni Rached'), ('02', 'Talassa'), ('02', 'Herenfa'), ('02', 'Oued Goussine'), ('02', 'Dahra'), ('02', 'Ouled Abbes'), ('02', 'Sendjas'), ('02', 'Zeboudja'), ('02', 'Oued Sly'), ('02', 'Abou El Hassen'), ('02', 'El Marsa'), ('02', 'Chettia'), ('02', 'Sidi Abderrahmane'), ('02', 'Moussadek'), ('02', 'El Hadjadj'), ('02', 'Labiod Medjadja'), ('02', 'Oued Fodda'), ('02', 'Ouled Ben Abdelkader'), ('02', 'Bouzghaia'), ('02', 'Ain Merane'), ('02', 'Oum Drou'), ('02', 'Breira'), ('02', 'Beni Bouateb'),
('03', 'Laghouat'), ('03', 'Ksar El Hirane'), ('03', 'Benacer Ben Chohra'), ('03', 'Sidi Makhlouf'), ('03', 'Hassi Delaa'), ('03', 'Hassi R''Mel'), ('03', 'Ain Mahdi'), ('03', 'Tadjmout'), ('03', 'El Kheneg'), ('03', 'Gueltat Sidi Saad'), ('03', 'Ain Sidi Ali'), ('03', 'Beidha'), ('03', 'Brida'), ('03', 'El Ghicha'), ('03', 'Hadj Mechri'), ('03', 'Sebgag'), ('03', 'Taouiala'), ('03', 'Tadjrouna'), ('03', 'Aflou'), ('03', 'El Assafia'), ('03', 'Oued Morra'), ('03', 'Oued M''Zi'), ('03', 'El Haouaita'), ('03', 'Sidi Bouzid'),
('04', 'Oum El Bouaghi'), ('04', 'Ain Beida'), ('04', 'Ain M''lila'), ('04', 'Behir Chergui'), ('04', 'El Amiria'), ('04', 'Sigus'), ('04', 'El Belala'), ('04', 'Ain Babouche'), ('04', 'Berriche'), ('04', 'Ouled Hamla'), ('04', 'Dhala'), ('04', 'Ain Kercha'), ('04', 'Hanchir Toumghani'), ('04', 'El Djazia'), ('04', 'Ain Diss'), ('04', 'Fkirina'), ('04', 'Souk Naamane'), ('04', 'Zorg'), ('04', 'El Fedjoudj Boughrara Saoudi'), ('04', 'Ouled Zouai'), ('04', 'Bir Chouhada'), ('04', 'Ksar Sbahi'), ('04', 'Oued Nini'), ('04', 'Meskiana'), ('04', 'Ain Fekroune'), ('04', 'Rahia'), ('04', 'Ain Zitoun'), ('04', 'Ouled Gacem'), ('04', 'El Harmilia'),
('05', 'Batna'), ('05', 'Ghassira'), ('05', 'Maafa'), ('05', 'Merouana'), ('05', 'Seriana'), ('05', 'Menaa'), ('05', 'El Madher'), ('05', 'Tazoult'), ('05', 'Ngaous'), ('05', 'Guigba'), ('05', 'Inoughissen'), ('05', 'Ouyoun El Assafir'), ('05', 'Djerma'), ('05', 'Bitam'), ('05', 'Metkaouak'), ('05', 'Arris'), ('05', 'Kimmel'), ('05', 'Tilatou'), ('05', 'Ain Djasser'), ('05', 'Ouled Selam'), ('05', 'Tigherghar'), ('05', 'Ain Yagout'), ('05', 'Fesdis'), ('05', 'Sefiane'), ('05', 'Rahbat'), ('05', 'Tighanimine'), ('05', 'Lemsane'), ('05', 'Ksar Belezma'), ('05', 'Seggana'), ('05', 'Ichmoul'), ('05', 'Foum Toub'), ('05', 'Beni Foudhala El Hakania'), ('05', 'Oued El Ma'), ('05', 'Talkhamt'), ('05', 'Bouzina'), ('05', 'Chemora'), ('05', 'Oued Chaaba'), ('05', 'Taxlent'), ('05', 'Gosbat'), ('05', 'Ouled Aouf'), ('05', 'Boumagueur'), ('05', 'Barika'), ('05', 'Djezzar'), ('05', 'Tkout'), ('05', 'Ain Touta'), ('05', 'Hidoussa'), ('05', 'Teniet El Abed'), ('05', 'Oued Taga'), ('05', 'Ouled Fadel'), ('05', 'Timgad'), ('05', 'Ras El Aioun'), ('05', 'Chir'), ('05', 'Ouled Si Slimane'), ('05', 'Zanat El Beida'), ('05', 'M''doukel'), ('05', 'Ouled Ammar'), ('05', 'El Hassi'), ('05', 'Lazrou'), ('05', 'Boumia'), ('05', 'Boulhilat'), ('05', 'Larbaa'),
('16', 'Alger Centre'), ('16', 'Sidi Mhamed'), ('16', 'El Madania'), ('16', 'Belouizdad'), ('16', 'Bab El Oued'), ('16', 'Bologhine'), ('16', 'Casbah'), ('16', 'Oued Koriche'), ('16', 'Bir Mourad Rais'), ('16', 'El Biar'), ('16', 'Bouzareah'), ('16', 'Birkhadem'), ('16', 'El Harrach'), ('16', 'Baraki'), ('16', 'Oued Smar'), ('16', 'Bourouba'), ('16', 'Hussein Dey'), ('16', 'Kouba'), ('16', 'Bachedjerah'), ('16', 'Dar El Beida'), ('16', 'Bab Azzouar'), ('16', 'Ben Aknoun'), ('16', 'Dely Ibrahim'), ('16', 'El Hammamet'), ('16', 'Rais Hamidou'), ('16', 'Djasr Kasentina'), ('16', 'El Mouradia'), ('16', 'Hydra'), ('16', 'Mohammadia'), ('16', 'Bordj El Kiffan'), ('16', 'El Magharia'), ('16', 'Beni Messous'), ('16', 'Les Eucalyptus'), ('16', 'Birtouta'), ('16', 'Tassala El Merdja'), ('16', 'Ouled Chebel'), ('16', 'Sidi Moussa'), ('16', 'Ain Taya'), ('16', 'Bordj El Bahri'), ('16', 'Marsa'), ('16', 'Haraoua'), ('16', 'Rouiba'), ('16', 'Reghaia'), ('16', 'Ain Benian'), ('16', 'Staoueli'), ('16', 'Zeralda'), ('16', 'Mahelma'), ('16', 'Rahmania'), ('16', 'Souidania'), ('16', 'Cheraga'), ('16', 'Ouled Fayet'), ('16', 'El Achour'), ('16', 'Draria'), ('16', 'Douera'), ('16', 'Baba Hassen'), ('16', 'Khracia'), ('16', 'Saoula'),
('31', 'Oran'), ('31', 'Gdyel'), ('31', 'Bir El Djir'), ('31', 'Hassi Bounif'), ('31', 'Es Senia'), ('31', 'Arzew'), ('31', 'Bethioua'), ('31', 'Marsat El Hadjadj'), ('31', 'Ain Turk'), ('31', 'El Ancar'), ('31', 'Oued Tlelat'), ('31', 'Tafraoui'), ('31', 'Sidi Chami'), ('31', 'Boufatis'), ('31', 'Mers El Kebir'), ('31', 'Bousfer'), ('31', 'El Karma'), ('31', 'El Braya'), ('31', 'Hassi Ben Okba'), ('31', 'Ben Freha'), ('31', 'Hassi Mefsoukh'), ('31', 'Sidi Ben Yabka'), ('31', 'Messerghin'), ('31', 'Boutlelis'), ('31', 'Ain Kerma'), ('31', 'Ain Biya');

-- (Remaining data will be added similarly. Please let me know once these are run and I will provide the next batch.)
-- The system is now integrated to fetch from these tables.
