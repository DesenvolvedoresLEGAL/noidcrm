-- Normalize existing porte values to match new standards
UPDATE accounts 
SET porte = 'Médio Porte' 
WHERE LOWER(porte) IN ('medio', 'médio', 'medio porte', 'demais');

UPDATE accounts 
SET porte = 'Grande Porte' 
WHERE LOWER(porte) IN ('grande', 'grande porte');

UPDATE accounts 
SET porte = 'ME' 
WHERE LOWER(porte) IN ('microempresa', 'micro empresa');

UPDATE accounts 
SET porte = 'EPP' 
WHERE LOWER(porte) IN ('pequeno porte', 'empresa de pequeno porte');