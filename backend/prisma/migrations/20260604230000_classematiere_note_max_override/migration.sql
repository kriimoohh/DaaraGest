-- Barème par classe pour normaliser les notes brutes (ex: RLC /60 en CE vs /40 en CM)
ALTER TABLE "ClasseMatiere" ADD COLUMN "note_max_override" DECIMAL(5,2);
