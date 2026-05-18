-- Tables pour la messagerie interne et le portail parents

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id"               TEXT NOT NULL,
  "etablissement_id" TEXT NOT NULL,
  "sujet"            TEXT NOT NULL,
  "type"             TEXT NOT NULL DEFAULT 'individuel',
  "cibles_roles"     JSONB,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Conversation_etablissement_id_fkey" FOREIGN KEY ("etablissement_id")
    REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
  "id"               TEXT NOT NULL,
  "conversation_id"  TEXT NOT NULL,
  "utilisateur_id"   TEXT NOT NULL,
  "derniere_lecture" TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversationParticipant_conversation_id_utilisateur_id_key" UNIQUE ("conversation_id", "utilisateur_id"),
  CONSTRAINT "ConversationParticipant_conversation_id_fkey" FOREIGN KEY ("conversation_id")
    REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationParticipant_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id")
    REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MessageConversation" (
  "id"              TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "expediteur_id"   TEXT NOT NULL,
  "corps"           TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageConversation_conversation_id_fkey" FOREIGN KEY ("conversation_id")
    REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageConversation_expediteur_id_fkey" FOREIGN KEY ("expediteur_id")
    REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PortailParentToken" (
  "id"               TEXT NOT NULL,
  "etablissement_id" TEXT NOT NULL,
  "eleve_id"         TEXT NOT NULL,
  "token"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "actif"            BOOLEAN NOT NULL DEFAULT true,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PortailParentToken_pkey"                           PRIMARY KEY ("id"),
  CONSTRAINT "PortailParentToken_token_key"                      UNIQUE ("token"),
  CONSTRAINT "PortailParentToken_etablissement_id_eleve_id_key"  UNIQUE ("etablissement_id", "eleve_id"),
  CONSTRAINT "PortailParentToken_etablissement_id_fkey" FOREIGN KEY ("etablissement_id")
    REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PortailParentToken_eleve_id_fkey" FOREIGN KEY ("eleve_id")
    REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
