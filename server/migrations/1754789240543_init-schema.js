export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createType('status_pembayaran', ['pending', 'settlement', 'cancel', 'expire', 'failure']);
  pgm.createType('status_release', ['pending', 'released']);
  pgm.createType('task_status', ['draft', 'merekrut', 'berjalan', 'selesai']);
  pgm.createType('status_rating', ['belum', 'sudah']);
  pgm.createType('message_type', ['text', 'image', 'file']);

  pgm.createTable('client_table', {
    id_client: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    pin_akses: { type: 'integer', notNull: true },
    nama_lengkap: { type: 'text', notNull: true },
    jenis_kelamin: { type: 'text', notNull: true },
    nomor_telepon: { type: 'text', notNull: true, unique: true },
    email: { type: 'text', notNull: true, unique: true },
    nik: { type: 'text', notNull: true, unique: true },
    nama_perusahaan: { type: 'text', notNull: true },
    jenis_usaha: { type: 'text', notNull: true },
    nomor_rekening: { type: 'text', notNull: true },
    profile_picture: { type: 'text' },
    nama_bank: { type: 'text', notNull: true },
    tanggal_lahir: { type: 'date', notNull: true },
    created_at_pin: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') }
  });

  pgm.createTable('respond_table', {
    id_respond: { type: 'text', primaryKey: true },
    nama_proyek: { type: 'text', notNull: true },
    deskripsi_proyek: { type: 'text', notNull: true },
    tenggat_pengerjaan: { type: 'timestamp', notNull: true },
    lokasi: { type: 'text', notNull: true },
    metode_survey: { type: 'text', notNull: true },
    id_client: { 
      type: 'uuid', 
      notNull: true, 
      references: 'client_table(id_client)',
      onDelete: 'CASCADE'
    },
    kompensasi: { type: 'text', notNull: true },
    jumlah_responden: { type: 'integer', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    status_task: { type: 'task_status', notNull: true, default: 'merekrut' },
    id_luaran: { type: 'uuid' },
    order_id: { type: 'text' },
    status_rating: { type: 'status_rating', notNull: true, default: 'belum' },
    tugas: { type: 'text' },
    keahlian: { type: 'text' },
    rentang_usia: { type: 'text' },
    hobi: { type: 'text' },
    tenggat_pendaftaran: { type: 'timestamp' }
  });

  // Luaran Respond
  pgm.createTable('luaran_respond', {
    id_luaran: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    file: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'diajukan' },
    diajukan_pada: { type: 'timestamp' },
    respond_id: { 
      type: 'text', 
      notNull: true,
      references: 'respond_table(id_respond)',
      onDelete: 'CASCADE'
    }
  });

  pgm.createTable('survey_table', {
    id_survey: { type: 'text', primaryKey: true },
    nama_proyek: { type: 'text', notNull: true },
    deskripsi_proyek: { type: 'text', notNull: true },
    tenggat_pengerjaan: { type: 'timestamp', notNull: true },
    keahlian: { type: 'text', notNull: true },
    tipe_hasil: { type: 'text' },
    kompensasi: { type: 'text', notNull: true },
    id_client: { 
      type: 'uuid', 
      notNull: true,
      references: 'client_table(id_client)',
      onDelete: 'CASCADE'
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    status_task: { type: 'task_status', notNull: true, default: 'merekrut' },
    id_luaran: { type: 'uuid' },
    status_rating: { type: 'status_rating', notNull: true, default: 'belum' },
    order_id: { type: 'text' },
    lokasi: { type: 'text' }
  });

  pgm.createTable('luaran_survey', {
    id_luaran: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    file: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'kosong' },
    diajukan_pada: { type: 'timestamp' },
    revisi: { type: 'boolean', notNull: true, default: false },
    survey_id: { 
      type: 'text', 
      notNull: true,
      references: 'survey_table(id_survey)',
      onDelete: 'CASCADE'
    }
  });

  pgm.createTable('responden_table', {
    id_responden: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    nama_lengkap: { type: 'text', notNull: true },
    jenis_kelamin: { type: 'text', notNull: true },
    nomor_telepon: { type: 'text', notNull: true, unique: true },
    email: { type: 'text', notNull: true, unique: true },
    nik: { type: 'text', notNull: true, unique: true },
    status_perkawinan: { type: 'text', notNull: true },
    domisili: { type: 'text', notNull: true },
    tingkat_pendidikan: { type: 'text', notNull: true },
    pekerjaan: { type: 'text', notNull: true },
    nomor_rekening: { type: 'text' },
    pin_akses: { type: 'integer', notNull: true },
    tanggal_lahir: { type: 'date', notNull: true },
    nama_bank: { type: 'text', notNull: true },
    hobi: { type: 'text', notNull: true },
    profile_picture: { type: 'text', notNull: true }
  });

  pgm.createTable('surveyor_table', {
    id_surveyor: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    pin_akses: { type: 'integer', notNull: true },
    nama_lengkap: { type: 'text', notNull: true },
    jenis_kelamin: { type: 'text', notNull: true },
    nomor_telepon: { type: 'text', notNull: true, unique: true },
    email: { type: 'text', notNull: true, unique: true },
    nik: { type: 'text', notNull: true, unique: true },
    domisili: { type: 'text', notNull: true },
    cv_ats: { type: 'text' },
    nomor_rekening: { type: 'text' },
    sum_rating: { type: 'integer' },
    total_project: { type: 'integer' },
    avg_rating: { type: 'text' },
    scout_trust: { type: 'text' },
    good_project: { type: 'integer' },
    nama_bank: { type: 'text', notNull: true },
    keahlian: { type: 'text' },
    tanggal_lahir: { type: 'date', notNull: true },
    profile_picture: { type: 'text' }
  });

  pgm.createTable('payment_table', {
    order_id: { type: 'text', primaryKey: true },
    id_surveyor: { 
      type: 'uuid',
      references: 'surveyor_table(id_surveyor)',
      onDelete: 'SET NULL'
    },
    id_survey: { 
      type: 'text',
      references: 'survey_table(id_survey)',
      onDelete: 'SET NULL'
    },
    id_responden: { 
      type: 'uuid',
      references: 'responden_table(id_responden)',
      onDelete: 'SET NULL'
    },
    id_respond: { 
      type: 'text',
      references: 'respond_table(id_respond)',
      onDelete: 'SET NULL'
    },
    jumlah_harga: { type: 'text', notNull: true },
    status_payment: { 
      type: 'status_pembayaran', 
      notNull: true, 
      default: 'pending' 
    },
    id_transaksi_midtrans: { type: 'text' },
    tanggal_pembuatan: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('now()') 
    },
    id_penerima: { type: 'uuid' },
    status_release: { 
      type: 'status_release', 
      notNull: true, 
      default: 'pending' 
    },
    release_date: { type: 'timestamp' },
    id_client: { 
      type: 'uuid',
      notNull: true,
      references: 'client_table(id_client)',
      onDelete: 'CASCADE'
    }
  });

  pgm.createTable('respond_draft_table', {
    id_draft: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    id_client: { 
      type: 'uuid', 
      notNull: true,
      references: 'client_table(id_client)',
      onDelete: 'CASCADE'
    },
    nama_proyek: { type: 'text' },
    deskripsi_proyek: { type: 'text' },
    tenggat_pengerjaan: { type: 'timestamp' },
    lokasi: { type: 'text' },
    kompensasi: { type: 'text' },
    metode_survey: { type: 'text' },
    status: { type: 'text' },
    order_id: { type: 'text' },
    created_at: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('now()') 
    },
    jumlah_responden: { type: 'integer' },
    status_task: { 
      type: 'task_status', 
      notNull: true, 
      default: 'draft' 
    },
    midtrans_token: { type: 'text' },
    midtrans_link: { type: 'text' },
    tugas: { type: 'text' },
    tenggat_pendaftaran: { type: 'timestamp' },
    rentang_usia: { type: 'text' },
    keahlian: { type: 'text' },
    hobi: { type: 'text' }
  });

  pgm.createTable('survey_draft_table', {
    id_draft: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    id_client: { 
      type: 'uuid', 
      notNull: true,
      references: 'client_table(id_client)',
      onDelete: 'CASCADE'
    },
    nama_proyek: { type: 'text' },
    deskripsi_proyek: { type: 'text' },
    tenggat_pengerjaan: { type: 'timestamp' },
    keahlian: { type: 'text' },
    kompensasi: { type: 'text' },
    status_pembayaran: { type: 'text' },
    order_id: { type: 'text' },
    created_at: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('now()') 
    },
    tipe_hasil: { type: 'text' },
    status_task: { 
      type: 'task_status', 
      notNull: true, 
      default: 'draft' 
    },
    midtrans_token: { type: 'text' },
    midtrans_link: { type: 'text' },
    lokasi: { type: 'text' }
  });

  pgm.createTable('respondent_application', {
    id_responden: { 
      type: 'uuid', 
      notNull: true,
      references: 'responden_table(id_responden)',
      onDelete: 'CASCADE'
    },
    id_respond: { 
      type: 'text', 
      notNull: true,
      references: 'respond_table(id_respond)',
      onDelete: 'CASCADE'
    },
    waktu_mendaftar: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('now()') 
    },
    status: { 
      type: 'text', 
      notNull: true, 
      default: 'pending' 
    },

    primaryKey: ['id_responden', 'id_respond']
  });


  pgm.createTable('surveyor_application', {
    id_surveyor: { 
      type: 'uuid', 
      notNull: true,
      references: 'surveyor_table(id_surveyor)',
      onDelete: 'CASCADE'
    },
    id_survey: { 
      type: 'text', 
      notNull: true,
      references: 'survey_table(id_survey)',
      onDelete: 'CASCADE'
    },
    waktu_mendaftar: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('now()') 
    },
    status: { 
      type: 'text', 
      notNull: true, 
      default: 'pending' 
    },
    primaryKey: ['id_surveyor', 'id_survey']
  });

  pgm.createTable('survey_chat', {
    id_chat: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    survey_id: { 
      type: 'text', 
      notNull: true,
      references: 'survey_table(id_survey)',
      onDelete: 'CASCADE'
    },
    surveyor_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'surveyor_table(id_surveyor)',
      onDelete: 'CASCADE'
    },
    message_content: { type: 'text', notNull: true },
    sent_at: { 
      type: 'timestamp', 
      notNull: true, 
      default: pgm.func('CURRENT_TIMESTAMP') 
    },
    message_type: { 
      type: 'message_type', 
      notNull: true, 
      default: 'text' 
    }
  });

  pgm.createTable('users_table', {
    id_user: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true },
    role: { type: 'text', notNull: true },
    profile_picture: { type: 'text', notNull: true }
  });
};

export const down = (pgm) => {
  pgm.dropTable('survey_chat');
  pgm.dropTable('surveyor_application');
  pgm.dropTable('respondent_application');
  pgm.dropTable('survey_draft_table');
  pgm.dropTable('respond_draft_table');
  pgm.dropTable('payment_table');
  pgm.dropTable('luaran_survey');
  pgm.dropTable('luaran_respond');
  pgm.dropTable('survey_table');
  pgm.dropTable('respond_table');
  pgm.dropTable('surveyor_table');
  pgm.dropTable('responden_table');
  pgm.dropTable('client_table');
  pgm.dropTable('users_table');

  pgm.dropType('message_type');
  pgm.dropType('status_rating');
  pgm.dropType('task_status');
  pgm.dropType('status_release');
  pgm.dropType('status_pembayaran');
};