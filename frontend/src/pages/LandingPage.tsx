import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { LogoMark } from '../components/ui/LogoMark';

// ─── Translations ─────────────────────────────────────────────────────────────
const T = {
  fr: {
    hero_title: 'La plateforme de gestion scolaire franco-arabe',
    hero_sub: 'DaaraGest centralise la gestion de votre école dans un outil simple, bilingue et adapté aux établissements franco-arabes du Sénégal.',
    hero_cta_login: 'Se connecter',
    hero_cta_guide: 'Voir les guides',
    hero_cta_dashboard: 'Aller au tableau de bord',
    features_title: 'Tout ce dont vous avez besoin',
    features_sub: 'Une suite complète de modules pour gérer chaque aspect de votre établissement',
    guides_title: 'Guides par rôle',
    guides_sub: 'Découvrez les fonctionnalités accessibles selon votre rôle dans l\'établissement',
    cta_title: 'Prêt à commencer ?',
    cta_sub: 'Connectez-vous à votre espace et prenez en main la gestion de votre école.',
    cta_btn: 'Accéder à la plateforme',
    footer_tagline: 'Gestion scolaire franco-arabe · Sénégal',
    features: [
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        ),
        title: 'Élèves & Inscriptions',
        desc: 'Fiches élèves complètes, gestion des inscriptions par classe et informations des tuteurs avec portail parent intégré.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        ),
        title: 'Professeurs & Classes',
        desc: 'Annuaire des enseignants, affectation aux classes et filières, gestion des contrats et du corps enseignant.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        ),
        title: 'Notes & Bulletins',
        desc: 'Saisie des notes par période, calcul automatique des moyennes et génération de bulletins PDF bilingues.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        ),
        title: 'Finances',
        desc: 'Suivi des paiements élèves et professeurs, gestion des reliquats, reçus automatiques et rapports mensuels.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
        title: 'Emploi du temps',
        desc: 'Planification hebdomadaire par classe, filière française et arabe, avec détection automatique des conflits.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        ),
        title: 'Messagerie & Calendrier',
        desc: 'Messagerie interne entre le personnel, calendrier scolaire partagé et portail parent pour le suivi des résultats.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        ),
        title: 'Pointage & Absences',
        desc: 'Suivi quotidien de la présence des professeurs et des élèves, justifications et statistiques par classe.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
          </svg>
        ),
        title: 'Documents officiels',
        desc: 'Génération automatique de certificats de scolarité, attestations, inscriptions et autres documents officiels en PDF prêts à imprimer.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
        ),
        title: 'Bibliothèque',
        desc: 'Gestion du fonds documentaire de l\'école : catalogue des livres, prêts aux élèves et enseignants, suivi des retours et inventaire du stock.',
      },
    ],
    roles: [
      { id: 'admin', label: 'Administrateur' },
      { id: 'directeur', label: 'Directeur' },
      { id: 'gestionnaire', label: 'Gestionnaire' },
      { id: 'agent', label: 'Agent de scolarité' },
      { id: 'professeur', label: 'Professeur' },
      { id: 'pointeur', label: 'Pointeur' },
    ],
    role_guides: {
      admin: {
        title: 'Administrateur',
        desc: 'L\'administrateur dispose d\'un accès complet à toutes les fonctionnalités de DaaraGest. Il configure l\'établissement, gère les comptes utilisateurs et supervise l\'ensemble des opérations.',
        access: [
          { label: 'Tableau de bord', detail: 'Vue globale sur les statistiques de l\'école : élèves inscrits, professeurs actifs, classes ouvertes, et bilan financier du mois.' },
          { label: 'Gestion des utilisateurs', detail: 'Créer, modifier et désactiver les comptes du personnel. Attribuer les rôles (directeur, gestionnaire, professeur, etc.) et gérer les accès.' },
          { label: 'Paramètres système', detail: 'Configurer les informations de l\'établissement, le barème de notation, les périodes scolaires, les tarifs de scolarité et les préférences d\'affichage.' },
          { label: 'Élèves & Inscriptions', detail: 'Accès complet aux dossiers élèves, inscriptions dans les classes, et génération des liens d\'accès au portail parent.' },
          { label: 'Professeurs', detail: 'Gestion complète des dossiers enseignants : spécialités, types de contrat, salaires et affectations aux classes.' },
          { label: 'Classes, Matières & Années', detail: 'Création et gestion des classes par filière (FR/AR), niveaux, matières, et configuration des années scolaires.' },
          { label: 'Notes & Évaluations', detail: 'Supervision de la saisie des notes, accès à toutes les évaluations par période et génération des bulletins PDF bilingues.' },
          { label: 'Finances', detail: 'Accès complet : paiements élèves, versements professeurs, retenues, reliquats et rapports financiers mensuels.' },
          { label: 'Documents officiels', detail: 'Génération de tous les documents officiels : certificats de scolarité, attestations et tout autre document en PDF.' },
          { label: 'Bibliothèque', detail: 'Gestion complète du fonds documentaire : catalogue des livres, gestion des prêts, suivi des retours et état du stock.' },
          { label: 'Statistiques analytiques', detail: 'Tableau de bord analytique avancé : taux de présence par classe, moyennes par filière, top/bottom élèves et alertes actives.' },
          { label: 'Évaluations & Progression', detail: 'Consultation des évaluations formatives et suivi de la progression académique pluriannuelle des élèves.' },
          { label: 'Activités parascolaires', detail: 'Gestion complète des activités, inscriptions, séances et évaluations des élèves participants.' },
          { label: 'Rapports', detail: 'Rapports synthétiques : présences élèves et professeurs, résultats par classe, bilan financier mensuel.' },
          { label: 'Messagerie & Calendrier', detail: 'Messagerie avec tous les membres du personnel et gestion complète du calendrier scolaire.' },
          { label: 'Pointage & Absences', detail: 'Supervision du pointage des professeurs et suivi complet des absences des élèves avec statistiques.' },
        ],
      },
      directeur: {
        title: 'Directeur',
        desc: 'Le directeur dispose d\'une vue globale sur toutes les activités de l\'établissement. Il pilote les équipes, suit les indicateurs pédagogiques et coordonne les opérations au quotidien.',
        access: [
          { label: 'Tableau de bord', detail: 'Statistiques de l\'établissement, évolution des paiements sur 6 mois et indicateurs de performance.' },
          { label: 'Élèves & Inscriptions', detail: 'Consultation et gestion complète des dossiers élèves, inscriptions dans les classes et suivi des effectifs.' },
          { label: 'Professeurs', detail: 'Gestion des dossiers enseignants, suivi des affectations, spécialités et informations contractuelles.' },
          { label: 'Classes, Matières & Années scolaires', detail: 'Configuration des classes, niveaux, filières, matières et gestion des années scolaires actives.' },
          { label: 'Notes, Évaluations & Bulletins', detail: 'Consultation des notes, accès à toutes les évaluations et génération des bulletins PDF par classe et période.' },
          { label: 'Finances (consultation)', detail: 'Consultation des paiements élèves, versements professeurs et reliquats — sans modification des données financières.' },
          { label: 'Emploi du temps', detail: 'Consultation et modification des emplois du temps de toutes les classes.' },
          { label: 'Pointage des professeurs', detail: 'Suivi quotidien de la présence, du retard ou de l\'absence des enseignants.' },
          { label: 'Absences des élèves', detail: 'Consultation et gestion du suivi des absences, taux de présence et alertes par classe.' },
          { label: 'Statistiques analytiques', detail: 'Tableau de bord analytique : taux de présence, moyennes par classe et filière, top élèves et alertes actives.' },
          { label: 'Rapports', detail: 'Rapports de présences élèves et professeurs, résultats par classe et bilan financier.' },
          { label: 'Progression des élèves', detail: 'Validation et suivi de la progression académique pluriannuelle des élèves, historique par élève.' },
          { label: 'Activités parascolaires', detail: 'Consultation et gestion des activités parascolaires, séances et évaluations.' },
          { label: 'Messagerie & Calendrier', detail: 'Messagerie interne avec l\'équipe et gestion des événements du calendrier scolaire.' },
          { label: 'Documents officiels', detail: 'Génération et consultation des certificats, attestations et documents officiels.' },
          { label: 'Bibliothèque', detail: 'Consultation du catalogue et des prêts en cours dans la bibliothèque de l\'établissement.' },
        ],
      },
      gestionnaire: {
        title: 'Gestionnaire',
        desc: 'Le gestionnaire assure la coordination administrative et financière de l\'établissement. Il gère les inscriptions, les paiements et la production de documents officiels.',
        access: [
          { label: 'Tableau de bord', detail: 'Vue sur les indicateurs clés : inscriptions du mois, paiements encaissés et classes actives.' },
          { label: 'Élèves & Inscriptions', detail: 'Création, modification et inscription des élèves dans les classes. Génération des liens portail parent.' },
          { label: 'Professeurs', detail: 'Gestion des dossiers professeurs, affectations aux classes et informations de contrat.' },
          { label: 'Classes, Matières & Années', detail: 'Création et gestion des classes, matières et années scolaires.' },
          { label: 'Finances', detail: 'Enregistrement des paiements élèves (mensualités, inscription, blouse), versements aux professeurs, gestion des reliquats et édition des reçus.' },
          { label: 'Documents officiels', detail: 'Génération de certificats de scolarité, attestations et tous les documents officiels en PDF.' },
          { label: 'Emploi du temps', detail: 'Consultation et mise à jour des emplois du temps de toutes les classes.' },
          { label: 'Évaluations formatives', detail: 'Consultation et saisie des évaluations formatives (devoirs, contrôles, examens) par classe et matière.' },
          { label: 'Activités parascolaires', detail: 'Gestion des inscriptions, séances et présences aux activités parascolaires.' },
          { label: 'Rapports', detail: 'Rapports de présences et de résultats par classe. Bilan financier mensuel.' },
          { label: 'Absences des élèves', detail: 'Consultation du suivi des absences et des statistiques de présence par classe.' },
          { label: 'Bibliothèque', detail: 'Gestion des prêts de livres, retours et consultation du catalogue documentaire.' },
          { label: 'Messagerie & Calendrier', detail: 'Messagerie interne avec l\'équipe et accès au calendrier scolaire.' },
        ],
      },
      agent: {
        title: 'Agent de scolarité',
        desc: 'L\'agent de scolarité est en contact direct avec les familles et les élèves. Il gère les inscriptions, enregistre les paiements et assure le suivi des présences au quotidien.',
        access: [
          { label: 'Élèves', detail: 'Consultation et gestion des dossiers élèves, mise à jour des informations personnelles et familiales.' },
          { label: 'Absences des élèves', detail: 'Saisie et suivi quotidien des absences par classe. Gestion des justificatifs, retards et dispenses. Statistiques de présence.' },
          { label: 'Finances', detail: 'Enregistrement des paiements de frais scolaires (mensualités, inscription, etc.), édition de reçus et suivi des reliquats.' },
          { label: 'Emploi du temps', detail: 'Consultation des emplois du temps par classe pour informer les familles.' },
          { label: 'Calendrier scolaire', detail: 'Consultation du calendrier des événements, examens et vacances scolaires.' },
          { label: 'Bibliothèque', detail: 'Consultation du catalogue et gestion des prêts de livres aux élèves.' },
          { label: 'Messagerie', detail: 'Communication interne avec l\'équipe pédagogique et administrative.' },
        ],
      },
      professeur: {
        title: 'Professeur',
        desc: 'Le professeur dispose des outils pédagogiques nécessaires pour gérer ses classes, saisir les notes et suivre la progression académique de ses élèves.',
        access: [
          { label: 'Mes classes', detail: 'Consultation de la liste des élèves dans chacune des classes assignées, réparties par filière et niveau.' },
          { label: 'Notes & Évaluations', detail: 'Saisie des notes par matière et par période (trimestre), création et gestion des évaluations pour ses classes.' },
          { label: 'Bulletins de notes', detail: 'Génération et consultation des bulletins de notes. Visualisation des moyennes par élève et par matière.' },
          { label: 'Activités pédagogiques', detail: 'Planification et suivi des activités scolaires et projets pour les classes assignées.' },
          { label: 'Progression des élèves', detail: 'Suivi de la progression académique des élèves au fil des périodes dans ses classes.' },
          { label: 'Emploi du temps', detail: 'Consultation de son emploi du temps personnel et des plannings de ses classes.' },
          { label: 'Absences (lecture)', detail: 'Consultation du suivi des absences de ses élèves pour ajuster son enseignement.' },
          { label: 'Messagerie & Calendrier', detail: 'Messagerie interne avec l\'équipe et consultation du calendrier des événements scolaires.' },
        ],
      },
      pointeur: {
        title: 'Pointeur',
        desc: 'Le pointeur se consacre à la gestion quotidienne de la présence du corps enseignant. Son travail est essentiel pour le suivi des absences et le calcul des rémunérations.',
        access: [
          { label: 'Pointage des professeurs', detail: 'Enregistrement quotidien du statut de chaque professeur : présent, absent, retard ou congé. Historique complet consultable.' },
          { label: 'Emploi du temps', detail: 'Consultation des emplois du temps pour connaître les créneaux de chaque enseignant et organiser le pointage.' },
          { label: 'Absences des élèves (lecture)', detail: 'Consultation du suivi des absences des élèves à titre d\'information.' },
          { label: 'Calendrier scolaire', detail: 'Accès au calendrier pour identifier les jours fériés et événements scolaires.' },
          { label: 'Messagerie', detail: 'Communication interne avec l\'équipe de l\'établissement.' },
        ],
      },
    },
  },

  ar: {
    hero_title: 'منصة الإدارة المدرسية الفرنسية-العربية',
    hero_sub: 'دارا جيست يجمع إدارة مدرستك في أداة بسيطة وثنائية اللغة، مصممة للمؤسسات الفرنسية-العربية في السنغال.',
    hero_cta_login: 'تسجيل الدخول',
    hero_cta_guide: 'عرض الأدلة',
    hero_cta_dashboard: 'الذهاب إلى لوحة التحكم',
    features_title: 'كل ما تحتاجه',
    features_sub: 'مجموعة متكاملة من الوحدات لإدارة كل جانب من جوانب مؤسستك',
    guides_title: 'أدلة حسب الدور',
    guides_sub: 'اكتشف الوظائف المتاحة حسب دورك في المؤسسة',
    cta_title: 'هل أنت مستعد للبدء؟',
    cta_sub: 'سجّل الدخول إلى مساحتك وتولّ إدارة مدرستك.',
    cta_btn: 'الوصول إلى المنصة',
    footer_tagline: 'الإدارة المدرسية الفرنسية-العربية · السنغال',
    features: [
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        ),
        title: 'التلاميذ والتسجيل',
        desc: 'ملفات تلاميذ كاملة، إدارة التسجيلات في الأقسام ومعلومات الأولياء مع بوابة أولياء متكاملة.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        ),
        title: 'الأساتذة والأقسام',
        desc: 'دليل المعلمين، التعيين في الأقسام والشعب، إدارة العقود وتتبع الهيئة التدريسية.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        ),
        title: 'الدرجات وشهادات النتائج',
        desc: 'إدخال الدرجات حسب الفصل، الحساب التلقائي للمعدلات وإنشاء شهادات النتائج PDF ثنائية اللغة.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        ),
        title: 'المالية',
        desc: 'متابعة مدفوعات التلاميذ والأساتذة، إدارة المتأخرات، الوصولات التلقائية والتقارير الشهرية.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
        title: 'جدول الحصص',
        desc: 'تخطيط أسبوعي لكل قسم، الشعبة الفرنسية والعربية، مع الكشف التلقائي عن تعارضات الجدول.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        ),
        title: 'المراسلة والتقويم',
        desc: 'مراسلة داخلية بين الموظفين، تقويم مدرسي مشترك وبوابة أولياء لمتابعة النتائج.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        ),
        title: 'الحضور والغيابات',
        desc: 'متابعة يومية لحضور الأساتذة والتلاميذ، التبريرات والإحصاءات حسب القسم.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
        title: 'الوثائق الرسمية',
        desc: 'إنشاء تلقائي لشهادات التمدرس والاعترافات وشهادات التسجيل وسائر الوثائق الرسمية PDF جاهزة للطباعة.',
      },
      {
        icon: (
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
        ),
        title: 'المكتبة',
        desc: 'إدارة الرصيد الوثائقي للمدرسة: فهرس الكتب، إعارة الكتب للتلاميذ والأساتذة، متابعة الإرجاع وجرد المخزون.',
      },
    ],
    roles: [
      { id: 'admin', label: 'المدير العام' },
      { id: 'directeur', label: 'المدير' },
      { id: 'gestionnaire', label: 'المسير' },
      { id: 'agent', label: 'عون التمدرس' },
      { id: 'professeur', label: 'الأستاذ' },
      { id: 'pointeur', label: 'مسجّل الحضور' },
    ],
    role_guides: {
      admin: {
        title: 'المدير العام',
        desc: 'يتمتع المدير العام بصلاحية الوصول الكامل لجميع وظائف دارا جيست. يضبط إعدادات المؤسسة ويدير حسابات المستخدمين ويشرف على جميع العمليات.',
        access: [
          { label: 'لوحة التحكم', detail: 'نظرة شاملة على إحصاءات المؤسسة: التلاميذ المسجلون، الأساتذة النشطون، الأقسام المفتوحة والبيانات المالية الشهرية.' },
          { label: 'إدارة المستخدمين', detail: 'إنشاء وتعديل وتعطيل حسابات الموظفين. تعيين الأدوار (مدير، مسير، أستاذ...) وإدارة صلاحيات الوصول.' },
          { label: 'إعدادات النظام', detail: 'ضبط معلومات المؤسسة، سلم التقييم، الفصول الدراسية، التعريفات وتفضيلات العرض.' },
          { label: 'التلاميذ والتسجيل', detail: 'وصول كامل لملفات التلاميذ، التسجيل في الأقسام وإنشاء روابط بوابة الأولياء.' },
          { label: 'الأساتذة', detail: 'الإدارة الكاملة لملفات الأساتذة: التخصصات، أنواع العقود، الرواتب والتعيينات في الأقسام.' },
          { label: 'الأقسام والمواد والسنوات', detail: 'إنشاء وإدارة الأقسام حسب الشعبة (فرنسي/عربي)، المستويات، المواد وإعداد السنوات الدراسية.' },
          { label: 'الدرجات والتقييمات', detail: 'الإشراف على إدخال الدرجات، الوصول لجميع التقييمات حسب الفصل وإنشاء شهادات النتائج ثنائية اللغة.' },
          { label: 'المالية', detail: 'وصول كامل: مدفوعات التلاميذ، مدفوعات الأساتذة، الاستقطاعات، المتأخرات والتقارير المالية الشهرية.' },
          { label: 'الوثائق الرسمية', detail: 'إنشاء جميع الوثائق الرسمية: شهادات التمدرس، الاعترافات وكل الوثائق الإدارية بصيغة PDF.' },
          { label: 'المكتبة', detail: 'الإدارة الكاملة للرصيد الوثائقي: فهرس الكتب، إدارة الإعارات، متابعة الإرجاع وحالة المخزون.' },
          { label: 'الإحصاءات التحليلية', detail: 'لوحة تحكم تحليلية متقدمة: نسب الحضور حسب القسم، المعدلات حسب الشعبة، أفضل التلاميذ والتنبيهات النشطة.' },
          { label: 'التقييمات والتقدم الدراسي', detail: 'الاطلاع على التقييمات التكوينية ومتابعة التقدم الأكاديمي متعدد السنوات للتلاميذ.' },
          { label: 'الأنشطة اللاصفية', detail: 'الإدارة الكاملة للأنشطة، التسجيلات، الحصص وتقييم التلاميذ المشاركين.' },
          { label: 'التقارير', detail: 'تقارير شاملة: حضور التلاميذ والأساتذة، نتائج الأقسام، البيان المالي الشهري.' },
          { label: 'المراسلة والتقويم', detail: 'المراسلة مع جميع أعضاء الهيئة وإدارة التقويم المدرسي بالكامل.' },
          { label: 'الحضور والغيابات', detail: 'الإشراف على سجل حضور الأساتذة والمتابعة الكاملة لغيابات التلاميذ مع الإحصاءات.' },
        ],
      },
      directeur: {
        title: 'المدير',
        desc: 'يتمتع المدير بنظرة شاملة على جميع أنشطة المؤسسة. يقود الفرق ويتابع المؤشرات التربوية والمالية ويشرف على سير العمل اليومي.',
        access: [
          { label: 'لوحة التحكم', detail: 'إحصاءات المؤسسة، تطور المدفوعات خلال 6 أشهر ومؤشرات الأداء الرئيسية.' },
          { label: 'التلاميذ والتسجيل', detail: 'الاستشارة والإدارة الكاملة لملفات التلاميذ والتسجيل في الأقسام ومتابعة الأعداد.' },
          { label: 'الأساتذة', detail: 'إدارة ملفات الأساتذة، متابعة التعيينات، التخصصات والمعلومات التعاقدية.' },
          { label: 'الأقسام والمواد والسنوات', detail: 'إعداد الأقسام، المستويات، الشعب، المواد وإدارة السنوات الدراسية النشطة.' },
          { label: 'الدرجات وشهادات النتائج', detail: 'الاطلاع على الدرجات، الوصول لجميع التقييمات وإنشاء شهادات النتائج حسب القسم والفصل.' },
          { label: 'المالية (قراءة)', detail: 'الاطلاع على مدفوعات التلاميذ والأساتذة والمتأخرات — دون تعديل البيانات المالية.' },
          { label: 'جدول الحصص', detail: 'الاطلاع على وتعديل جداول حصص جميع الأقسام.' },
          { label: 'سجل حضور الأساتذة', detail: 'المتابعة اليومية لحضور وغياب وتأخر الأساتذة.' },
          { label: 'غيابات التلاميذ', detail: 'الاطلاع وإدارة سجلات الغياب ونسب الحضور والتنبيهات حسب القسم.' },
          { label: 'الإحصاءات التحليلية', detail: 'لوحة تحكم تحليلية: نسب الحضور، المعدلات حسب القسم والشعبة، أفضل التلاميذ والتنبيهات النشطة.' },
          { label: 'التقارير', detail: 'تقارير الحضور والنتائج حسب القسم وبيان المالية الشهري.' },
          { label: 'التقدم الدراسي', detail: 'التحقق من صحة ومتابعة التقدم الأكاديمي متعدد السنوات للتلاميذ والاطلاع على السجل التاريخي.' },
          { label: 'الأنشطة اللاصفية', detail: 'الاطلاع وإدارة الأنشطة اللاصفية والحصص والتقييمات.' },
          { label: 'المراسلة والتقويم', detail: 'المراسلة الداخلية مع الفريق وإدارة أحداث التقويم المدرسي.' },
          { label: 'الوثائق الرسمية', detail: 'إنشاء والاطلاع على شهادات التمدرس والاعترافات والوثائق الرسمية.' },
          { label: 'المكتبة', detail: 'الاطلاع على الفهرس والإعارات الجارية في مكتبة المؤسسة.' },
        ],
      },
      gestionnaire: {
        title: 'المسير',
        desc: 'يضمن المسير التنسيق الإداري والمالي للمؤسسة. يدير التسجيلات والمدفوعات وإنتاج الوثائق الرسمية.',
        access: [
          { label: 'لوحة التحكم', detail: 'نظرة على المؤشرات الرئيسية: تسجيلات الشهر، المدفوعات المحصّلة والأقسام النشطة.' },
          { label: 'التلاميذ والتسجيل', detail: 'إنشاء وتعديل وتسجيل التلاميذ في الأقسام. إنشاء روابط بوابة الأولياء.' },
          { label: 'الأساتذة', detail: 'إدارة ملفات الأساتذة، التعيينات في الأقسام ومعلومات العقود.' },
          { label: 'الأقسام والمواد والسنوات', detail: 'إنشاء وإدارة الأقسام والمواد والسنوات الدراسية.' },
          { label: 'المالية', detail: 'تسجيل مدفوعات التلاميذ (أقساط، تسجيل، بلوزة)، مدفوعات الأساتذة، إدارة المتأخرات وطباعة الوصولات.' },
          { label: 'الوثائق الرسمية', detail: 'إنشاء شهادات التمدرس والاعترافات وسائر الوثائق الرسمية بصيغة PDF.' },
          { label: 'جدول الحصص', detail: 'الاطلاع على وتحديث جداول حصص الأقسام.' },
          { label: 'التقييمات التكوينية', detail: 'الاطلاع وإدخال التقييمات التكوينية (واجبات، اختبارات، امتحانات) حسب القسم والمادة.' },
          { label: 'الأنشطة اللاصفية', detail: 'إدارة التسجيلات والحصص والحضور في الأنشطة اللاصفية.' },
          { label: 'التقارير', detail: 'تقارير الحضور والنتائج حسب القسم. البيان المالي الشهري.' },
          { label: 'غيابات التلاميذ', detail: 'الاطلاع على سجلات الغياب وإحصاءات الحضور حسب القسم.' },
          { label: 'المكتبة', detail: 'إدارة إعارات الكتب والإرجاعات والاطلاع على الفهرس الوثائقي.' },
          { label: 'المراسلة والتقويم', detail: 'المراسلة الداخلية مع الفريق والوصول إلى التقويم المدرسي.' },
        ],
      },
      agent: {
        title: 'عون التمدرس',
        desc: 'عون التمدرس على اتصال مباشر مع الأسر والتلاميذ. يدير التسجيلات ويسجل المدفوعات ويتابع الحضور اليومي.',
        access: [
          { label: 'التلاميذ', detail: 'الاطلاع وإدارة ملفات التلاميذ وتحديث المعلومات الشخصية والعائلية.' },
          { label: 'غيابات التلاميذ', detail: 'إدخال ومتابعة الغيابات اليومية حسب القسم. إدارة التبريرات والتأخيرات والإعفاءات. إحصاءات الحضور.' },
          { label: 'المالية', detail: 'تسجيل مدفوعات الرسوم الدراسية (أقساط، تسجيل...)، طباعة الوصولات ومتابعة المتأخرات.' },
          { label: 'جدول الحصص', detail: 'الاطلاع على جداول الحصص حسب القسم لإعلام الأسر.' },
          { label: 'التقويم المدرسي', detail: 'الاطلاع على تقويم الأحداث والامتحانات والعطل المدرسية.' },
          { label: 'المكتبة', detail: 'الاطلاع على الفهرس وإدارة إعارات الكتب للتلاميذ.' },
          { label: 'المراسلة', detail: 'التواصل الداخلي مع الفريق التربوي والإداري.' },
        ],
      },
      professeur: {
        title: 'الأستاذ',
        desc: 'يصل الأستاذ إلى الأدوات التربوية اللازمة لإدارة أقسامه وإدخال الدرجات ومتابعة التقدم الأكاديمي لتلاميذه.',
        access: [
          { label: 'أقسامي', detail: 'الاطلاع على قائمة التلاميذ في كل قسم معيّن، مرتبة حسب الشعبة والمستوى.' },
          { label: 'الدرجات والتقييمات', detail: 'إدخال الدرجات حسب المادة والفصل الدراسي، إنشاء وإدارة التقييمات لأقسامه.' },
          { label: 'شهادات النتائج', detail: 'إنشاء والاطلاع على شهادات النتائج. عرض المعدلات حسب التلميذ والمادة.' },
          { label: 'الأنشطة التربوية', detail: 'تخطيط ومتابعة الأنشطة المدرسية والمشاريع للأقسام المعيّنة.' },
          { label: 'التقدم الدراسي', detail: 'متابعة التقدم الأكاديمي للتلاميذ عبر الفصول الدراسية في أقسامه.' },
          { label: 'جدول الحصص', detail: 'الاطلاع على جدول حصصه الخاص وجداول أقسامه.' },
          { label: 'الغيابات (قراءة)', detail: 'الاطلاع على سجل غيابات تلاميذه لتكييف تدريسه.' },
          { label: 'المراسلة والتقويم', detail: 'المراسلة الداخلية مع الفريق والاطلاع على التقويم المدرسي.' },
        ],
      },
      pointeur: {
        title: 'مسجّل الحضور',
        desc: 'يتخصص مسجّل الحضور في الإدارة اليومية لحضور الهيئة التدريسية. دوره أساسي لمتابعة الغيابات وحساب المستحقات.',
        access: [
          { label: 'سجل حضور الأساتذة', detail: 'التسجيل اليومي لوضعية كل أستاذ: حاضر، غائب، متأخر أو في إجازة. سجل كامل قابل للاستشارة.' },
          { label: 'جدول الحصص', detail: 'الاطلاع على جداول حصص الأساتذة لمعرفة أوقات كل منهم وتنظيم عملية التسجيل.' },
          { label: 'غيابات التلاميذ (قراءة)', detail: 'الاطلاع على سجل غيابات التلاميذ كمعلومة.' },
          { label: 'التقويم المدرسي', detail: 'الوصول إلى التقويم للتعرف على الأيام الرسمية والأحداث المدرسية.' },
          { label: 'المراسلة', detail: 'التواصل الداخلي مع فريق المؤسسة.' },
        ],
      },
    },
  },
} as const;

type Lang = 'fr' | 'ar';
type RoleId = 'admin' | 'directeur' | 'gestionnaire' | 'agent' | 'professeur' | 'pointeur';

// ─── Icons ────────────────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3a9 9 0 100 18A9 9 0 0012 3zm0 16a7 7 0 010-14c.34 0 .67.03 1 .07A5.99 5.99 0 0010 11a6 6 0 006 6 5.99 5.99 0 004.93-2.93c.04.32.07.66.07 1a7 7 0 01-9 6.93z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function LandingPage() {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<Lang>((i18n.language as Lang) === 'ar' ? 'ar' : 'fr');
  const [activeRole, setActiveRole] = useState<RoleId>('admin');
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuthStore();

  const t = T[lang];
  const guide = t.role_guides[activeRole];

  // Page vitrine : contenu FR/AR uniquement (dictionnaire local T), donc sélecteur
  // à deux langues — distinct du sélecteur d'interface fr/ar/en de l'application.
  const setLangTo = (next: Lang) => {
    setLang(next);
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--card)', borderBottom: '1px solid var(--rule)',
        padding: '0 clamp(16px, 4vw, 40px)', height: 60,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <LogoMark size={30} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Daara<span style={{ color: 'var(--terra)' }}>Gest</span>
          </span>
        </Link>

        <div style={{ flex: 1 }} />

        <select
          className="input"
          value={lang}
          onChange={e => setLangTo(e.target.value as Lang)}
          aria-label="Langue"
          title="Langue"
          style={{ width: 'auto', height: 36, padding: '0 26px 0 10px', fontSize: 13 }}
        >
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
        <button className="tb-btn" onClick={toggleTheme} title="Changer de thème" aria-label="Changer de thème">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        {isAuthenticated ? (
          <Link to="/dashboard" className="btn btn-primary btn-sm" style={{ minHeight: 36 }}>
            {t.hero_cta_dashboard}
          </Link>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm" style={{ minHeight: 36 }}>
            {t.hero_cta_login}
          </Link>
        )}
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, var(--paper) 0%, var(--paper-2) 60%, var(--paper-3) 100%)',
        padding: 'clamp(60px, 10vw, 100px) clamp(16px, 4vw, 40px)',
        textAlign: 'center',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -80, insetInlineEnd: -60, width: 320, height: 320, borderRadius: '50%', background: 'var(--terra-soft)', opacity: 0.35, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, insetInlineStart: -40, width: 220, height: 220, borderRadius: '50%', background: 'var(--sahel-soft)', opacity: 0.3, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 700, margin: '0 auto' }}>
          <LogoMark size={72} />

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24, padding: '5px 14px', background: 'var(--terra-soft)', borderRadius: 999, fontSize: 12, fontWeight: 600, color: 'var(--terra-ink)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            DaaraGest
          </div>

          <h1 className="font-display" style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 700, margin: '16px 0 0', letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--ink)' }}>
            {t.hero_title}
          </h1>
          <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--ink-2)', margin: '18px auto 36px', maxWidth: 580, lineHeight: 1.65 }}>
            {t.hero_sub}
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                {t.hero_cta_dashboard}
              </Link>
            ) : (
              <Link to="/login" className="btn btn-primary btn-lg">
                {t.hero_cta_login}
              </Link>
            )}
            <a href="#guides" className="btn btn-secondary btn-lg">
              {t.hero_cta_guide}
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px, 8vw, 96px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 className="font-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px' }}>
              {t.features_title}
            </h2>
            <p style={{ fontSize: 16, color: 'var(--ink-3)', margin: 0 }}>
              {t.features_sub}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {t.features.map((f, i) => (
              <div key={i} className="card" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'box-shadow 0.15s' }}>
                <div style={{ color: 'var(--terra)', flexShrink: 0 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>{f.title}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role Guides ────────────────────────────────────────────────────── */}
      <section id="guides" style={{ background: 'var(--paper-2)', padding: 'clamp(60px, 8vw, 96px) clamp(16px, 4vw, 40px)', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 className="font-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px' }}>
              {t.guides_title}
            </h2>
            <p style={{ fontSize: 16, color: 'var(--ink-3)', margin: 0 }}>
              {t.guides_sub}
            </p>
          </div>

          {/* Role tab bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
            {t.roles.map(r => {
              const active = activeRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRole(r.id as RoleId)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--r-xl)',
                    border: '1px solid',
                    borderColor: active ? 'var(--terra)' : 'var(--rule-2)',
                    background: active ? 'var(--terra)' : 'var(--card)',
                    color: active ? '#fff' : 'var(--ink-2)',
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                    fontFamily: 'inherit',
                    lineHeight: 1,
                    minHeight: 36,
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Guide card */}
          <div className="card" style={{ padding: 'clamp(24px, 4vw, 36px)' }}>
            <div style={{ marginBottom: 24 }}>
              <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                {guide.title}
              </h3>
              <p style={{ fontSize: 14.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.65 }}>
                {guide.desc}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {guide.access.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: 'var(--paper)', borderRadius: 'var(--r-md)', border: '1px solid var(--rule)' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--terra-soft)', color: 'var(--terra)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    <CheckIcon />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, color: 'var(--ink)' }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--terra)',
        padding: 'clamp(48px, 7vw, 80px) clamp(16px, 4vw, 40px)',
        textAlign: 'center',
      }}>
        <h2 className="font-display" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 600, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          {t.cta_title}
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', margin: '0 auto 28px', maxWidth: 460, lineHeight: 1.6 }}>
          {t.cta_sub}
        </p>
        {isAuthenticated ? (
          <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'var(--card)', color: 'var(--terra-ink)', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: 15, textDecoration: 'none', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}>
            {t.hero_cta_dashboard}
          </Link>
        ) : (
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'var(--card)', color: 'var(--terra-ink)', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: 15, textDecoration: 'none', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}>
            {t.cta_btn}
          </Link>
        )}
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--card)', borderTop: '1px solid var(--rule)', padding: '40px clamp(16px, 4vw, 40px)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <LogoMark size={28} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' }}>
            Daara<span style={{ color: 'var(--terra)' }}>Gest</span>
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: '0 0 20px' }}>
          {t.footer_tagline}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, fontSize: 13, color: 'var(--ink-3)' }}>
          <Link to="/login" style={{ color: 'var(--terra)', textDecoration: 'none', fontWeight: 500 }}>
            {t.hero_cta_login}
          </Link>
          <span style={{ color: 'var(--rule-2)' }}>·</span>
          <span>© {new Date().getFullYear()} DaaraGest</span>
        </div>
      </footer>

    </div>
  );
}
