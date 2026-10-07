/* EGA Policy Change Desk — carrier mapping layer (Beneva)
 * One plan-builder per (carrier, form). Each returns:
 *   { text: {FIELD: value}, radio: {FIELD: exportNamePrefix}, check: {FIELD: true}, notes: [] }
 * Shared by the browser app and the Node verification harness.
 *
 * Verified quirks (rendered + visually inspected 2026-10-06):
 *  - Beneva life-beneficiary tables (FIND0205A p1, FIND0206A p8) and the insured-name block on FIND0205A:
 *    the field tagged NOM_* sits under the "First name" column, PRENOM_* under "Last name". We map visually.
 *  - FIND0205A p2 (Insured 2) revocable/irrevocable radios are named "1","2","3" and are SHARED between
 *    the primary and contingent rows. Not filled in v1; joint policies are flagged.
 *  - FIND0205A p4 NOM_COMPLET_FIDUCIAIRE_1/2 are the policyowner 1/2 signature-name lines.
 *  - FIND0203A S1_7 / S1_8 are signature boxes (witness / cessionary): intentionally left blank.
 *  - No form has a fillable field for a signature itself: all signatures are wet or e-signed afterwards.
 */
(function (root) {
  'use strict';

  // ---------- helpers ----------
  const s = (v) => (v == null ? '' : String(v).trim());
  const ymd = (iso) => s(iso).replace(/[^0-9]/g, '').slice(0, 8);         // 2026-10-06 -> 20261006
  const digits = (v, n) => s(v).replace(/\D/g, '').slice(0, n || 99);
  const up = (v) => s(v).toUpperCase();
  const postal = (v) => s(v).replace(/\s|-/g, '').toUpperCase().slice(0, 6);
  const yn = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : undefined);
  const fullName = (p) => s([s(p && p.first), s(p && p.last)].filter(Boolean).join(' '));
  const listNames = (arr) => (arr || []).map((x) => s(typeof x === 'string' ? x : x.name || fullName(x))).filter(Boolean).join(', ');
  const isUL = (r) => r.policy && r.policy.product === 'universal_life';
  const sigDate = (r) => (r.signing && r.signing.prefill_date ? ymd(r.signing.date) : '');

  function put(plan, field, value) {
    const v = s(value);
    if (v !== '') plan.text[field] = v;
  }
  // choice = prefix of the button's export (on-state) name, e.g. 'Yes', 'Irrevocable', 'Passport'
  function radio(plan, field, choice) {
    if (choice !== undefined && choice !== null && choice !== '') plan.radio[field] = String(choice);
  }
  const REVOC = (irrev) => (irrev ? 'Irrevocable' : 'Revocable');
  const FREQ = (f) => (f === 'annual' ? 'Annual' : 'Monthly');
  const PAYMENT = ['Pre-authorized debit drawn from the same', 'Pre-authorized debit drawn from a new', 'Change of payer', 'Payment change to annual', 'Payment change to monthly'];
  const newPlan = () => ({ text: {}, radio: {}, check: {}, notes: [] });

  const ID_DOCS = ['drivers', 'passport', 'citizenship', 'other'];
  const ID_EXPORT = ['Driver', 'Passport', 'Citizenship', 'Other'];
  const PURPOSE_EXPORT = ['Income', 'Estate', 'Charitable'];
  const PURPOSES = ['income', 'estate', 'charity'];

  // ---------- FIND0205A Change of beneficiary ----------
  function planBeneficiary(r) {
    const p = newPlan();
    const pol = r.policy || {};
    const b = r.beneficiary || {};
    put(p, 'NO_CONTRAT_PROPOSITION', pol.number);
    put(p, 'NOM_PROPRIETAIRE', s(pol.owners && pol.owners[0] && pol.owners[0].name));
    put(p, 'NOM_PROPRIETAIRE_ACTUEL2', s(pol.owners && pol.owners[1] && pol.owners[1].name));
    const ins = (pol.insureds || [])[0] || {};
    // visual: NOM_* = "First name" column
    put(p, 'NOM_ASSURE_CONCERNE_1', ins.first);
    put(p, 'PRENOM_ASSURE_CONCERNE_1', ins.last);

    const prim = (b.primary || []).slice(0, 3);
    const primLastField = ['PRENOM_BENEFICIARE_L1', 'PRENOM_BENEFICIAIRE_L1', 'PRENOM_BENEFICIAIRE_L2', 'PRENOM_BENEFICAIRE_L3'];
    prim.forEach((x, i) => {
      const n = i + 1;
      put(p, 'NOM_BENEFICIAIRE_L' + n, x.first);
      put(p, primLastField[n], x.last);
      put(p, 'LIEN_ASSURE_L' + n, x.relationship);
      if (fullName(x)) radio(p, 'ASS' + n, REVOC(x.irrevocable));
      put(p, 'QUOTE_PART_L' + n, digits(x.share, 3));
    });
    (b.contingent || []).slice(0, 3).forEach((x, i) => {
      const n = i + 1;
      put(p, 'NOM_BENEFICIAIRE_SUBSIDIAIRE_L' + n, x.first);
      put(p, 'PRENOM_BENEFICIAIRE_SUBSIDIAIRE_L' + n, x.last);
      put(p, 'LIEN_ASSURE_SUBSIDIAIRE_L' + n, x.relationship);
      if (fullName(x)) radio(p, 'ASS_SUB' + n, REVOC(x.irrevocable));
      put(p, 'QUOTE_PART_SUBSIDIAIRE_L' + n, digits(x.share, 3));
    });
    const m = b.minor || {};
    put(p, 'NOM_BENEFICIAIRE_MINEUR', m.first);
    put(p, 'PRENOM_BENEFICIAIRE_MINEUR', m.last);
    put(p, 'NOM_COMPLET_FIDUCIAIRE', m.trustee);
    put(p, 'LIEN_ASSURE', m.relationship);

    // p4 signature-name lines
    const owners = pol.owners || [];
    const d = sigDate(r);
    put(p, 'NOM_COMPLET_FIDUCIAIRE_1', up(owners[0] && owners[0].name));
    if (owners[0] && owners[0].name) put(p, 'DATE_FIDUCIAIRE_1', d);
    put(p, 'NOM_COMPLET_FIDUCIAIRE_2', up(owners[1] && owners[1].name));
    if (owners[1] && owners[1].name) put(p, 'DATE_FIDUCIAIRE_2', d);
    put(p, 'NOM_COMPLET_TEMOIN', up(r.signing && r.signing.witness));
    if (r.signing && r.signing.witness) put(p, 'DATE_TEMOIN', d);
    if (pol.has_irrevocable) { put(p, 'NOM_COMPLET_BENEFICIAIRE_IRREV', up(pol.irrevocable_name)); put(p, 'DATE_BENEFICIAIRE_IRREV', d); }
    if (pol.owner_bankrupt) {
      put(p, 'NOM_COMPLET_TITRE_PERS_AUTORISE', s(pol.bankruptcy_trustee && pol.bankruptcy_trustee.name));
      put(p, 'TEL_NO_RES_PERS_AUTORISE', digits(pol.bankruptcy_trustee && pol.bankruptcy_trustee.phone, 10));
      put(p, 'DATE_PERSONNE_AUTORISE', d);
    }
    if ((pol.insureds || []).filter((x) => fullName(x)).length > 1)
      p.notes.push('Joint policy: Insured 2 beneficiaries (page 2) are not filled. Beneva\'s Insured 2 revocable/irrevocable boxes are shared between primary and contingent rows. Complete page 2 by hand.');
    return p;
  }

  // ---------- FIND0206A Transfer of ownership ----------
  function planTransfer(r) {
    const p = newPlan();
    const pol = r.policy || {};
    const t = r.transfer || {};
    const d = sigDate(r);
    const ul = isUL(r);
    put(p, 'NO_CONTRAT_PROPOSITION', pol.number);
    put(p, 'NOM_PROPRIETAIRE', s(pol.owners && pol.owners[0] && pol.owners[0].name));
    put(p, 'NOM_PROPRIETAIRE_2', s(pol.owners && pol.owners[1] && pol.owners[1].name));
    put(p, 'NOM_ASSURE_1', fullName((pol.insureds || [])[0]));
    put(p, 'NOM_ASSURE_2', fullName((pol.insureds || [])[1]));

    const type = t.new_type || 'individual';
    if (type === 'individual') {
      (t.owners || []).slice(0, 2).forEach((o, i) => {
        const n = i + 1;
        if (!s(o.name)) return;
        put(p, 'NOM_COMPLET_PROPRIETAIRE' + n, o.name);
        put(p, 'DT_NAISSANCE_AAAAMMJJ_PROPRIETAIRE' + n, ymd(o.dob));
        put(p, n === 1 ? 'RELATION_PROPRIETAIRE_TIERS' : 'RELATION_PROPRIETAIRE2_TIERS', o.relationship);
        put(p, 'ADR_NO_RUE_PROPRIETAIRE' + n, o.street);
        put(p, 'ADR_APP_PROPRIETAIRE' + n, o.apt);
        put(p, 'ADR_VILLE_PROPRIETAIRE' + n, o.city);
        put(p, 'ADR_PROV_PROPRIETAIRE' + n, o.province);
        put(p, 'ADR_CODE_POST_PROPRIETAIRE' + n + '_A9A9A9', postal(o.postal));
        put(p, 'TEL_NO_RES_PROPRIETAIRE' + n, digits(o.phone_home, 10));
        put(p, 'TEL_CELL_PROPRIETAIRE' + n, digits(o.phone_cell, 10));
        if (ul) {
          put(p, 'PROFESSION_PERSONNE_PROPRIETAIRE' + n, o.occupation);
          put(p, 'NOM_EMPLOYEUR_PROPRIETAIRE' + n, o.employer);
          put(p, 'STATUT_PROPRIETAIRE' + n, o.status);
        }
        // A2 tax residence (both WL and UL)
        radio(p, 'titualire statut ' + n, o.tax_canada === false ? 'I am a tax resident of a' : 'I am a tax resident of Canada');
        // A3 identity (UL only)
        if (ul) {
          put(p, 'NOM_COMPLET_PROPR' + n, o.name);
          const di = ID_DOCS.indexOf(o.id_doc);
          if (di >= 0) radio(p, 'Assure_verif_' + n, ID_EXPORT[di]);
          if (o.id_doc === 'other') put(p, 'PIECE_ID_AUTRE' + n, o.id_other);
          put(p, 'NO_PIECE_ID' + n, o.id_number);
          put(p, 'PROVINCE_PAYS_DELIVRANCE' + n, o.id_jurisdiction);
          put(p, 'DATE_EXPIRATION_PIECE' + n, ymd(o.id_expiry));
        }
      });
      if (ul) {
        if (t.id_method === 'in_person') radio(p, 'A3_IDENTIFICATION', 'EN_PRESENCE');
        if (t.id_method === 'remote') p.check['A3_IDENTIFICATIONaaaa'] = true;
        const pi = PURPOSES.indexOf(t.purpose);
        if (pi >= 0) radio(p, 'A4_BUT', PURPOSE_EXPORT[pi]);
      }
    } else if (type === 'corporation') {
      const c = t.corp || {};
      put(p, 'DENOMINATION_SOCIALE_COMPLETE', c.name);
      put(p, 'NATURE_ENTREPRISE', c.activity);
      put(p, 'RELATION_ENTREPRISE_TIERS', c.relationship);
      put(p, 'ADR_COMPLET_ENTREPRISE', c.address);
      (c.admins || []).slice(0, 4).forEach((a, i) => put(p, 'NOM_COMPLET_ADMINISTRATEUR' + (i + 1), a));
    } else if (type === 'trust_estate') {
      const c = t.trust || {};
      put(p, 'NOM_COMPLET_FIDUCIE', c.name);
      put(p, 'RELATION_FIDUCIE_TIERS', c.relationship);
      put(p, 'ADR_COMPLET_SUCCESSION', c.address);
      if (!ul) (c.parties || []).slice(0, 4).forEach((x, i) => {
        put(p, 'NOM_COMPLET_BENEF_L' + (i + 1), x.name);
        put(p, 'ADR_COMPLET_BENEF_L' + (i + 1), x.address);
        put(p, 'PROFESSION_BENEF_L' + (i + 1), x.occupation);
      });
    } else if (type === 'nonprofit') {
      const c = t.npo || {};
      put(p, 'NOM_COMPLET_ORGANISME', c.name);
      put(p, 'ADR_COMPLET_ORGANISME', c.address);
      put(p, 'RELATION_ORGANISME_TIERS', c.relationship);
      radio(p, 'DON', yn(c.solicits));
      put(p, 'ACTIVITE_PRINCIPALE_ORGANISME', c.activity);
      radio(p, 'ARC', yn(c.cra));
      if (c.cra === 'yes') put(p, 'NO_ENREGISTREMENT_ARC', c.cra_number);
    }

    // E contingent / successor owner
    (t.contingent || []).slice(0, 2).forEach((x, i) => {
      const n = i + 1;
      if (!s(x.name)) return;
      put(p, 'NOM_COMPLET_PROP_SUBS' + n, x.name);
      put(p, 'RELATION_ASSURE_PROP_SUBS' + n, x.relationship);
      put(p, 'DT_NAISSANCE_AAAAMMJJ_PROP_SUBS' + n, ymd(x.dob));
    });
    if ((t.contingent || []).some((x) => s(x.name))) {
      put(p, 'DT_DECL_AAAAMMJJ_PROP_SUBS1', d);
      if (signatoryNames(r)[1]) put(p, 'DT_DECL_AAAAMMJJ_PROP_SUBS2', d);
    }

    // F declarations
    const dc = t.decl || {};
    radio(p, 'I2_1a_1', yn(dc.spouse));
    if (dc.spouse !== 'yes') radio(p, 'I2_1b_1', yn(dc.former_spouse));
    if (dc.former_spouse === 'yes') put(p, 'DT_SEPARATION_AAAAMMJJ_PROP', ymd(dc.separation_date));
    radio(p, 'I2_1c_1', yn(dc.canada));
    radio(p, 'I2_1d_1', yn(dc.consideration));
    if (dc.consideration === 'yes') put(p, 'MONTANT_VERSE', dc.amount);
    put(p, 'SIGN_DATE_CONS_PROP1_AAAAMMJJ', d);
    if (pol.owners && pol.owners[1] && s(pol.owners[1].name)) put(p, 'SIGN_DATE_CONS_PROP2_AAAAMMJJ', d);
    put(p, 'SIGN_NOM_CONS_TEMOIN', up(r.signing && r.signing.witness));
    if (r.signing && r.signing.witness) put(p, 'SIGN_DATE_CONS_TEMOIN_AAAAMMJJ', d);

    // G irrevocable beneficiary consent
    if (pol.has_irrevocable) { put(p, 'SIGN_NOM_CONS_BENEF_IRREV', up(pol.irrevocable_name)); put(p, 'SIGN_DATE_CONS_BENEF_IRREV', d); }
    // H assignee consent
    if (pol.has_assignment) {
      put(p, 'NOM_COMPLET_CESSIONNAIRE', pol.assignee && pol.assignee.name);
      put(p, 'TEL_NO_RES_CESSIONNAIRE', digits(pol.assignee && pol.assignee.phone, 10));
      put(p, 'SIGN_NOM_CONS_CESSIONNAIRE', pol.assignee && pol.assignee.signatory);
      put(p, 'SIGN_DATE_CONS_CESSIONNAIRE', d);
    }
    // I bankruptcy trustee
    if (pol.owner_bankrupt) {
      put(p, 'SIGN_NOM_CONS_SYNDIC', pol.bankruptcy_trustee && pol.bankruptcy_trustee.name);
      put(p, 'TEL_NO_RES_SYNDIC', digits(pol.bankruptcy_trustee && pol.bankruptcy_trustee.phone, 10));
      put(p, 'SIGN_DATE_CONS_SYNDIC_AAAAMMJJ', d);
    }
    // J premium payment
    if (s(t.payment) !== '') radio(p, 'PAIEMENT', PAYMENT[Number(t.payment)]);
    // K third-party (UL)
    if (ul) {
      const tp = r.third_party || {};
      radio(p, 'PAYEUR DIFF', yn(tp.payer_differs));
      radio(p, 'TIERS', yn(tp.access));
      if (tp.payer_differs === 'yes' || tp.access === 'yes') {
        put(p, 'NOM_COMPLET_TIERS', tp.name);
        put(p, 'DATE_NAISSANCE_PERSONNE_TIERS', ymd(tp.dob));
        put(p, 'ADR_COMPLET_TIERS', tp.address);
        put(p, 'TEL_NO_RES_TIERS', digits(tp.phone, 10));
        put(p, 'PROFESSION_PERSONNE_TIERS', tp.occupation);
        put(p, 'RELATION_PRENEUR_TIERS', tp.relationship);
        put(p, 'NO_ENTREPRISE_TIERS', tp.business_no);
        put(p, 'PROVINCE_PAYS_DELIVRANCE', tp.place);
      }
    }
    // L new beneficiaries (Insured 1, life) — same visual name-order rule as FIND0205A
    if (t.change_beneficiary) {
      const b = r.beneficiary || {};
      const lastF = ['', 'PRENOM_BENEFICIAIRE_L1', 'PRENOM_BENEFICIAIRE_L2', 'PRENOM_BENEFICAIRE_L3'];
      (b.primary || []).slice(0, 3).forEach((x, i) => {
        const n = i + 1;
        put(p, 'NOM_BENEFICIAIRE_L' + n, x.first);
        put(p, lastF[n], x.last);
        put(p, 'LIEN_ASSURE_L' + n, x.relationship);
        if (fullName(x)) radio(p, 'ASS' + n, REVOC(x.irrevocable));
        put(p, 'QUOTE_PART_L' + n, digits(x.share, 3));
      });
      (b.contingent || []).slice(0, 3).forEach((x, i) => {
        const n = i + 1;
        put(p, 'NOM_BENEFICIAIRE_SUBSIDIAIRE_L' + n, x.first);
        put(p, 'PRENOM_BENEFICIAIRE_SUBSIDIAIRE_L' + n, x.last);
        put(p, 'LIEN_ASSURE_SUBSIDIAIRE_L' + n, x.relationship);
        if (fullName(x)) radio(p, 'ASS_SUB' + n, REVOC(x.irrevocable));
        put(p, 'QUOTE_PART_SUBSIDIAIRE_L' + n, digits(x.share, 3));
      });
      const m = b.minor || {};
      put(p, 'NOM_BENEFICIAIRE_MINEUR', m.first);
      put(p, 'PRENOM_BENEFICIAIRE_MINEUR', m.last);
      put(p, 'NOM_COMPLET_FIDUCIAIRE', m.trustee);
      put(p, 'LIEN_ASSURE', m.relationship);
    }
    // M new owner signatures (names in capitals)
    const sig = signatoryNames(r);
    put(p, 'SIGN_NOM_DECL_NOUV-PROP', up(sig[0]));
    if (sig[0]) put(p, 'SIGN_DATE_DECL_NOUV-PROP_AAAAMMJJ', d);
    put(p, 'SIGN_NOM_DECL_NOUV-PROP2', up(sig[1]));
    if (sig[1]) put(p, 'SIGN_DATE_DECL_NOUV-PROP2_AAAAMMJJ', d);
    put(p, 'SIGN_NOM_DECL_TEMOIN', up(r.signing && r.signing.witness));
    if (r.signing && r.signing.witness) put(p, 'SIGN_DATE_DECL_TEMOIN_AAAAMMJJ', d);
    // N advisor (UL)
    if (ul) {
      put(p, 'NOM_COMPLET_CONSEILLER', r.advisor && r.advisor.name);
      put(p, 'CODE_CONSEILLER', r.advisor && r.advisor.code);
      put(p, 'SIGN_DATE_DECL_CONSEILLER_AAAAMMJJ', d);
    }
    // O pre-authorized debit (payment options 1 new account, 2 change of payer, 4 monthly)
    if ([1, 2, 4].includes(Number(t.payment)) && t.payment !== '') {
      const pad = r.pad || {};
      const bank = pad.bank || {};
      radio(p, 'DPA_ANNUEL_MENSUEL', FREQ(pad.frequency));
      if (pad.frequency !== 'annual') put(p, 'JOUR_PRELEV_PERIODIQUE', digits(pad.day, 2).padStart(pad.day ? 2 : 0, '0'));
      put(p, 'NOM_INST_BANCAIRE', bank.name);
      put(p, 'ADR_COMPLET_INST_BANCAIRE', bank.address);
      put(p, 'INFO_BANCAIRE_SUCC', digits(bank.transit, 5));
      put(p, 'INFO_BANCAIRE_INST', digits(bank.institution, 3));
      put(p, 'INFO_BANCAIRE_COMPTE', digits(bank.account, 12));
      radio(p, 'CONJOINT', pad.joint ? 'Yes' : 'No');
      put(p, 'SIGN_NOM_AUTO_PAYEUR', (pad.holders || [])[0]);
      if ((pad.holders || [])[0]) put(p, 'SIGN_DATE_AUTO_PAYEUR_AAAAMMJJ', d);
      if (pad.joint) {
        put(p, 'SIGN_NOM_AUTO_PAYEUR2', (pad.holders || [])[1]);
        if ((pad.holders || [])[1]) put(p, 'SIGN_DATE_AUTO_PAYEUR2_AAAAMMJJ', d);
      }
    }
    return p;
  }

  function signatoryNames(r) {
    const t = r.transfer || {};
    if ((t.new_type || 'individual') === 'individual') return (t.owners || []).map((o) => s(o.name)).filter(Boolean).slice(0, 2);
    return (t.signatories || []).map(s).filter(Boolean).slice(0, 2);
  }

  // ---------- FIND0072A Assignment of the contract ----------
  function planAssignment(r) {
    const p = newPlan();
    const pol = r.policy || {};
    const a = r.assignment || {};
    put(p, 'NO_CONTRAT_PROPOSITION', pol.number);
    put(p, 'NOM_COMPLET_ASSURE', listNames((pol.insureds || []).map(fullName)));
    put(p, 'NOM_COMPLET_PROPRIETAIRE', listNames(pol.owners));
    put(p, 'NOM_CESSIONNAIRE', a.assignee_name);
    put(p, 'SIGN_VILLE_DECL_PROPRIETAIRE', r.signing && r.signing.place);
    put(p, 'SIGN_DATE_DECL_PROPRIETAIRE_AAAAMMJJ', sigDate(r));
    put(p, 'ADR_COMPLET_CESSIONNAIRE', a.assignee_address);
    // DT_ENREGISTREMENT / NOM_SIGNATAIRE are head-office only: never filled
    return p;
  }

  // ---------- FIND0203A Revoking cession ----------
  function planCession(r) {
    const p = newPlan();
    const pol = r.policy || {};
    const c = r.cession || {};
    put(p, 'Insurance policy number', pol.number);
    put(p, 'S1_2', listNames((pol.insureds || []).map(fullName)));
    put(p, 'S1_3', listNames(pol.owners));
    put(p, 'S1_4', c.cessionaries);
    put(p, 'S1_5', r.signing && r.signing.place);
    if (r.signing && r.signing.prefill_date) {
      const d = s(r.signing.date);
      if (d) put(p, 'S1_6', d);
    }
    return p;
  }

  // ---------- FIND0168A Pre-authorized debit ----------
  function planPAD(r) {
    const p = newPlan();
    const pol = r.policy || {};
    const pad = r.pad || {};
    const bank = pad.bank || {};
    const d = sigDate(r);
    put(p, 'NO_CONTRAT_PROPOSITION', pol.number);
    put(p, 'NO_CONTRAT_PROPOSITION_2', (pol.numbers_extra || [])[0]);
    put(p, 'NO_CONTRAT_PROPOSITION_3', (pol.numbers_extra || [])[1]); // real name contains a soft hyphen; matched loosely
    radio(p, 'DPA_ANNUEL_MENSUEL', FREQ(pad.frequency));
    if (pad.frequency !== 'annual' && s(pad.day)) put(p, 'JOUR_DPA', digits(pad.day, 2).padStart(2, '0'));
    put(p, 'NOM_INST_BANCAIRE', bank.name);
    put(p, 'ADR_COMPLET_INST_BANCAIRE', bank.address);
    put(p, 'INFO_BANCAIRE_SUCC', digits(bank.transit, 5));
    put(p, 'INFO_BANCAIRE_INST', digits(bank.institution, 3));
    put(p, 'INFO_BANCAIRE_COMPTE', digits(bank.account, 12));
    put(p, 'NOM_COMPLET_TITULAIRE COMPTE', up((pad.holders || [])[0]));
    if ((pad.holders || [])[0]) put(p, 'SIGN_DATE_AUTO_PAYEUR_AAAAMMJJ', d);
    if (pad.joint) {
      put(p, 'NOM_COMPLET_TITULAIRE_CJT_COMPTE', up((pad.holders || [])[1]));
      if ((pad.holders || [])[1]) put(p, 'SIGN_DATE_AUTO_PAYEURCJT_AAAAMMJJ', d);
    }
    if (isUL(r)) {
      const tp = r.third_party || {};
      radio(p, 'PAYEUR_PRIMES_DIFFERENT', yn(tp.payer_differs));
      radio(p, 'ACCES_TIERS_CONTRAT', yn(tp.access));
      if (tp.payer_differs === 'yes' || tp.access === 'yes') {
        put(p, 'NOM_COMPLET_TIERS', tp.name);
        put(p, 'DATE_NAISSANCE_PERSONNE_TIERS', ymd(tp.dob));
        put(p, 'ADRESSE_COMPLET_TIERS', tp.address);
        put(p, 'TEL_COMPLET_RES_TIERS', digits(tp.phone, 10));
        put(p, 'PROFESSION_PERSONNE_TIERS', tp.occupation);
        put(p, 'RELATION_PRENEUR_TIERS', tp.relationship);
        put(p, 'NO_ENTREPRISE_TIERS', tp.business_no);
        put(p, 'LIEU_CONSTITUTION_ENTREPRISE_TIERS', tp.place);
      }
    }
    return p;
  }

  // ---------- registry ----------
  const CHANGE_TYPES = {
    beneficiary:        { label: 'Change of beneficiary',     form: 'FIND0205A', file: 'forms/FIND0205A.pdf', plan: planBeneficiary, copies: 1 },
    ownership_transfer: { label: 'Transfer of ownership',     form: 'FIND0206A', file: 'forms/FIND0206A.pdf', plan: planTransfer,    copies: 1 },
    assignment:         { label: 'Assignment of the contract', form: 'FIND0072A', file: 'forms/FIND0072A.pdf', plan: planAssignment,  copies: 2 },
    revoke_cession:     { label: 'Revoking cession',          form: 'FIND0203A', file: 'forms/FIND0203A.pdf', plan: planCession,     copies: 2 },
    pad:                { label: 'Pre-authorized debit',      form: 'FIND0168A', file: 'forms/FIND0168A.pdf', plan: planPAD,         copies: 1 },
  };

  // ---------- requirements: signers, attachments, warnings ----------
  function requirements(r) {
    const type = r.change_type;
    const pol = r.policy || {};
    const t = r.transfer || {};
    const owners = (pol.owners || []).filter((o) => s(o.name));
    const signers = [];
    const att = [];
    const warn = [];
    const addS = (who, role, section) => signers.push({ who: s(who) || '(name needed)', role, section });
    const addA = (id, label, why) => att.push({ id, label, why });

    const ownerDocs = () => {
      if (pol.owner_kind === 'corporation') addA('corp_registry', 'Provincial corporate registry extract, or a resolution naming the authorized signatories', 'Current owner is a corporation');
      if (pol.owner_kind === 'trust') addA('trust_agreement', 'Trust agreement (or equivalent) plus the trustees\' decision', 'Current owner is a trust');
      if (pol.owner_kind === 'estate') addA('death_will', 'Death certificate and last will and testament', 'Current owner is an estate');
      if (pol.owner_unfit) addA('poa', 'Court-sanctioned power of attorney', 'Current owner is unfit to sign');
    };
    const ownerSigners = (section) => {
      if (!owners.length) addS('', 'Current policyowner', section);
      owners.forEach((o) => addS(o.name, 'Current policyowner', section));
    };
    const irrev = (section) => {
      if (pol.has_irrevocable) {
        addS(pol.irrevocable_name, 'Irrevocable beneficiary (consent)', section);
        warn.push('Irrevocable beneficiary on file. If they are a minor, a court order is required. If they are deceased, attach the death certificate.');
      }
    };
    const trustee = (section) => { if (pol.owner_bankrupt) addS(pol.bankruptcy_trustee && pol.bankruptcy_trustee.name, 'Trustee in bankruptcy', section); };

    if (type === 'beneficiary') {
      ownerSigners('Signatures, page 4');
      addS(r.signing && r.signing.witness, 'Witness', 'Signatures, page 4');
      irrev('Page 4'); trustee('Page 4'); ownerDocs();
      const b = r.beneficiary || {};
      const prim = (b.primary || []).filter((x) => fullName(x));
      const cont = (b.contingent || []).filter((x) => fullName(x));
      const tot = (xs) => xs.reduce((a, x) => a + (Number(x.share) || 0), 0);
      if (!prim.length) warn.push('Add at least one primary beneficiary.');
      if (prim.length && prim.some((x) => s(x.share)) && tot(prim) !== 100) warn.push('Primary beneficiary shares total ' + tot(prim) + '%. They must total 100%.');
      if (cont.length && cont.some((x) => s(x.share)) && tot(cont) !== 100) warn.push('Contingent beneficiary shares total ' + tot(cont) + '%. They must total 100%.');
      if (prim.concat(cont).some((x) => x.irrevocable)) warn.push('New irrevocable designation: the owner gives up the right to change it without that beneficiary\'s consent. Confirm the client understands this.');
      if (pol.province === 'QC') warn.push('Quebec: naming a married or civil-union spouse is irrevocable unless stated otherwise. The minor-trustee section does not apply.');
      if (b.minor && s(b.minor.first) && !s(b.minor.trustee) && pol.province !== 'QC') warn.push('Minor beneficiary named without a trustee. Without one, proceeds go to a court-appointed guardian.');
    }
    if (type === 'ownership_transfer') {
      ownerSigners('F: current owner consent');
      addS(r.signing && r.signing.witness, 'Witness', 'F and M');
      signatoryNames(r).forEach((n) => addS(n, (t.new_type || 'individual') === 'individual' ? 'New policyowner' : 'Authorized signatory, new owner', 'M: new owner declarations'));
      if (!signatoryNames(r).length) addS('', 'New policyowner / signatory', 'M');
      irrev('G'); trustee('I');
      if (pol.has_assignment) addS(pol.assignee && (pol.assignee.signatory || pol.assignee.name), 'Assignee (consent)', 'H');
      if (isUL(r)) addS(r.advisor && r.advisor.name, 'Advisor declaration', 'N');
      ownerDocs();
      const ul = isUL(r);
      const nt = t.new_type || 'individual';
      if (nt !== 'individual') addA(ul ? 'fra1235a' : 'fra1748a', ul ? 'FRA1235A: Verification of the identity of corporations and other entities' : 'FRA1748A: Declaration of tax residence (self-certification), entity', 'New owner is an entity');
      if (nt === 'individual' && (t.owners || []).some((o) => s(o.name) && o.tax_canada === false)) addA('fra1737a', 'FRA1737A: Declaration of tax residence (self-certification), individual', 'New owner is not a Canadian tax resident');
      if (nt === 'individual' && ul && t.id_method === 'remote') addA('fra1913a', 'FRA1913A: Dual-process identity verification, advisor declaration', 'Identity verified remotely (UL)');
      if ([1, 2, 4].includes(Number(t.payment)) && t.payment !== '') addA('cheque', 'Specimen cheque marked "VOID"', 'Premium payment change');
      if ([2, 4].includes(Number(t.payment)) && t.payment !== '') ((r.pad && r.pad.holders) || ['']).filter((h, i) => i === 0 || (r.pad && r.pad.joint)).forEach((h) => addS(h, 'Account holder (PAD)', 'O'));
      if (t.decl && t.decl.spouse !== 'yes' && t.decl.consideration === 'yes') warn.push('Consideration was paid on a non-spousal transfer. Beneva will issue a T5 to the current owner, so flag the possible tax gain to the client.');
      if (t.decl && t.decl.spouse === 'yes') warn.push('Spousal transfer: it generally rolls over at ACB with no disposition. Confirm with the client\'s tax advisor.');
      if (ul && !s(r.advisor && r.advisor.code)) warn.push('Universal life: section N needs your Beneva advisor number.');
    }
    if (type === 'assignment') {
      ownerSigners('Owner signature, each with a witness');
      owners.forEach(() => addS(r.signing && r.signing.witness, 'Witness', 'Opposite each signature'));
      irrev('Irrevocable beneficiary line');
      addS(r.assignment && r.assignment.assignee_name, 'Assignee', 'Assignee signature line');
      ownerDocs();
      warn.push('Sign two originals. Beneva returns one registered copy to the assignee.');
      if (!s(r.signing && r.signing.place)) warn.push('"Signed at (city and province)" is blank.');
    }
    if (type === 'revoke_cession') {
      addS(r.cession && r.cession.cessionaries, 'Cessionary (lender releasing the assignment)', 'Signature of the cessionary');
      addS(r.signing && r.signing.witness, 'Witness', 'Signature of the witness');
      warn.push('The cessionary signs this form, not the client. Sign two originals; Beneva returns one registered copy.');
    }
    if (type === 'pad') {
      const h = (r.pad && r.pad.holders) || [];
      addS(h[0], 'Account holder', 'Section 5');
      if (r.pad && r.pad.joint) addS(h[1], 'Joint account holder', 'Section 5');
      addA('cheque', 'Specimen cheque marked "VOID"', 'Required for every PAD');
      const b = (r.pad && r.pad.bank) || {};
      if (s(b.transit) && digits(b.transit).length !== 5) warn.push('The branch (transit) number must be 5 digits.');
      if (s(b.institution) && digits(b.institution).length !== 3) warn.push('The institution number must be 3 digits.');
      if (s(b.account) && digits(b.account).length > 12) warn.push('The account number is longer than the form\'s 12 boxes.');
      if (r.pad && r.pad.frequency === 'annual') warn.push('Annual withdrawal is not available for former La Capitale products.');
    }
    if (isUL(r) && (type === 'pad' || type === 'ownership_transfer')) {
      const tp = r.third_party || {};
      if (!tp.payer_differs || !tp.access) warn.push('Universal life: answer both third-party determination questions.');
    }
    return { signers, attachments: att, warnings: warn };
  }

  // ---------- PDF fill (pdf-lib) ----------
  const norm = (n) => String(n).replace(/[­\s]/g, '');
  async function fillPdf(PDFLib, bytes, plan) {
    const doc = await PDFLib.PDFDocument.load(bytes);
    const form = doc.getForm();
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const byName = {};
    form.getFields().forEach((f) => { byName[norm(f.getName())] = f; });
    const missing = [];
    const safe = (txt) => Array.from(txt).map((ch) => { try { font.encodeText(ch); return ch; } catch (e) { return '?'; } }).join('');
    for (const [k, v] of Object.entries(plan.text)) {
      const f = byName[norm(k)];
      if (!f || !f.setText) { missing.push(k); continue; }
      let val = safe(v);
      const ml = f.getMaxLength && f.getMaxLength();
      if (ml) val = val.slice(0, ml);
      f.setText(val);
    }
    const { PDFName } = PDFLib;
    const decode = (nm) => { try { return nm.decodeText(); } catch (e) { return String(nm).replace(/^\//, ''); } };
    // Works for true radio groups and for Beneva's same-name checkbox groups alike.
    const press = (f, choice) => {
      const widgets = f.acroField.getWidgets();
      const want = String(choice).toLowerCase();
      let hit = null;
      widgets.forEach((w) => { const on = w.getOnValue(); if (on && !hit && decode(on).toLowerCase().startsWith(want)) hit = on; });
      if (!hit) return false;
      widgets.forEach((w) => { const on = w.getOnValue(); w.setAppearanceState(on && decode(on) === decode(hit) ? on : PDFName.of('Off')); });
      f.acroField.dict.set(PDFName.of('V'), hit);
      return true;
    };
    for (const [k, choice] of Object.entries(plan.radio)) {
      const f = byName[norm(k)];
      if (!f || !f.acroField.getWidgets) { missing.push(k); continue; }
      if (!press(f, choice)) missing.push(k + '=' + choice);
    }
    for (const k of Object.keys(plan.check)) {
      const f = byName[norm(k)];
      if (!f || !f.acroField.getWidgets) { missing.push(k); continue; }
      const on = f.acroField.getWidgets().map((w) => w.getOnValue()).find(Boolean);
      if (on && !press(f, decode(on))) missing.push(k);
    }
    form.updateFieldAppearances(font);
    const out = await doc.save();
    return { bytes: out, missing, filled: Object.keys(plan.text).length + Object.keys(plan.radio).length + Object.keys(plan.check).length };
  }

  const api = { CHANGE_TYPES, requirements, fillPdf, helpers: { ymd, digits, fullName, listNames } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BenevaMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
