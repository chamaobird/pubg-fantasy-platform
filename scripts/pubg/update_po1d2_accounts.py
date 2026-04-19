"""
update_po1d2_accounts.py
Atualiza account_ids, aliases e display_names dos jogadores do PO1-D2
com base no match 8db196ba-7f8a-4614-a229-165c5b30e746.
"""
import os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from datetime import datetime, timezone

load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))
NOW = datetime.now(timezone.utc)

# 1. Pending/NULL → real account_id
# (display_name_ATUAL_no_banco, old_alias_ou_None, novo_account_id, novo_alias, novo_display_name)
UPDATES_PENDING = [
    # Tempest - HUGHLIGAN e xQnn eram null
    ('TMP_HUGHLIGAN', None,        'account.5be1abcdf90540de9a862f795469bf22', 'TMP_HUGHLIGAN', None),
    ('TMP_abdou',     'abdou',     'account.91228bed5f86409088915d754b48bad7', 'TMP_abdou',     None),
    ('TMP_K1lawi',    'K1lawi',    'account.e83e1168e8da4b3486597ccea6d308db', 'TMP_K1lawi',    None),
    ('TMP_xQnn',      None,        'account.4053b8ffa43a4fd7b9d92442a2d7ebd8', 'TMP_xQnn',      None),
    # Team FATE
    ('DadBuff',       'Palecks',   'account.098a229da85a4e659620274ec63ccf3f', 'FATE_DadBuff',  'FATE_DadBuff'),
    ('fl8nkr',        'fl8nkr',    'account.aa6b0602cc0941009fc2ec7f3b0c311d', 'FATE_fl8nkr',   'FATE_fl8nkr'),
    ('TATER-_-',      'TATER-_-',  'account.4b306d5ebd794fa9a47895ca192d15fd', 'FATE_Tater',    'FATE_Tater'),
    # Injected
    ('Choppy-_-',     'Choppy-_-', 'account.7e0ab40ce8b24b2fae2e5b0d45c1cd1f', 'INJ_choppy-_-', 'INJ_choppy-_-'),
    ('Stokeley',      'Stokeley',  'account.b15781ae97bd402eb3a4126ea0a7c8c5', 'INJ_Stokeley',  'INJ_Stokeley'),
    # Affinity
    ('gh0wst',        'gh0wst',    'account.8b4c01d0c8054096a7a91d8ac8d90768', 'AFi_Ghowst',    'AFi_Ghowst'),
    ('Zalody',        'Zalody',    'account.d878e92e33ee44e7a065ada5bb87d5f9', 'AFi_Zalody',    'AFi_Zalody'),
    # Chupinskys
    ('Gabudo',        'Gabudo',    'account.83ae6dc94c564913a8a468d94a8e72b0', 'INSK_gabudo',   'INSK_gabudo'),
    ('Oracle_',       'Oracle_',   'account.7f968d0e3ae747ca944fec0b69e5c45f', 'INSK_0racle_',  'INSK_0racle_'),
    # RENT FREE
    ('BLZZLER',       'BLZZLER',   'account.cb724f0963c54059b5698895b18d8db3', 'FR_Bizzler',    'FR_Bizzler'),
]

# 2. Conta errada (nao-pending) → desativa antiga + insere nova
# (display_name_ATUAL_no_banco, old_account_id, novo_account_id, novo_alias, novo_display_name)
UPDATES_WRONG = [
    # Affinity
    ('NDucky-',        'account.f622ce41c43348c68e5a8c2cd52134c5', 'account.92ab57fdcab740c1b482a0411884f177', 'AFi_NDucky',     'AFi_NDucky'),
    ('Mizbo',          'account.2c66edc52eb1437ea7be2f6f91c5d957', 'account.f77f9346b8e048548a14f1cc032782ca', 'AFi_Mizbo',      'AFi_Mizbo'),
    # Chupinskys
    ('Luizeer4',       'account.28f8bd1c5519497fa6a481432f8e6161', 'account.0ee77576982b429e9234c891df584747', 'INSK_Luizeer4',  'INSK_Luizeer4'),
    ('tuuruuruu',      'account.5a7726a9b06d41cba3331f839d475b20', 'account.070167055f7f44e8ade447f33f694bd2', 'INSK_tuuruuruu', 'INSK_tuuruuruu'),
    # Collector
    ('4EARTH-',        'account.32d61e3e99ab4c009f1fd9cdcaca82e5', 'account.b7ef3ce203914c878f151d7e8359ad63', 'CLR_4EARTH',     'CLR_4EARTH'),
    ('DarkDreamzz',    'account.867d8f818fc34d6d9ffaa9315274f8bb', 'account.c39115c345324cff8021668482ad546c', 'CLR_Dreamzz',    'CLR_Dreamzz'),
    ('RedRyderNA',     'account.1ac37fb70b184d3092526684e7f6bfbb', 'account.22109fa1a29f47279a58951ab21bcd2a', 'CLR_RedRyderNA', 'CLR_RedRyderNA'),
    # IAM BOLIVIA
    ('C4MB4',          'account.1905ea08faaa4f7a9e1a095aac5dec3f', 'account.9f2cebb5134c4bf5b20b90605c452564', 'BO_C4MB4',       'BO_C4MB4'),
    ('Neyzhera',       'account.4ed660fa77d54ee188209daef1385056', 'account.9792a6009b1141c1b5de6e180c100841', 'BO_Neyzhera',    'BO_Neyzhera'),
    ('V-I-R-I',        'account.bd26bdb3f541484188f0d024c69d3e3a', 'account.f8709dcfcb6046d49289759f54e212b1', 'BO_V-I-R-I',     'BO_V-I-R-I'),
    # Injected
    ('s1mplicityy',    'account.5ac0a156802e4c7ab5a1139651f75dc2', 'account.01f4314ff09a4eac90b7755d60a098ff', 'INJ_s1mplicityy','INJ_s1mplicityy'),
    # RENT FREE
    ('HoneyBadger-_-', 'account.60aa9df901a0455dbbba3afe8188fe8b', 'account.5bbb1818e3594f8d926cee2e5df470f3', 'FR_HoneyBadger', 'FR_HoneyBadger'),
    ('J4M_d-_-b',      'account.a0a1785b15fc44b989bb2281455953e0', 'account.a03f02f4122440e98b7fdb6550372590', 'FR_J4M',         'FR_J4M'),
    # Team FATE
    ('TimFee',         'account.d16223ae72f44094ae4f2051e4aea539', 'account.d954ed4dd2734d4c9b9466a50f4fc46c', 'FATE_TimFee',    'FATE_TimFee'),
]

# 3. Alias changes para jogadores cujo account_id ja estava correto
# (display_name_ATUAL, novo_display_name)
DISPLAY_NAME_ONLY = [
    ('NA_Poonage',       'NA_ega'),
    ('NA_xxxxxxxxxppppp','NA_Balefrost'),
    ('X10_Sukehiro--',   'X10_kl4uZeera'),
    ('55PD_glock77',     '55PD_gloock77'),
    ('NA_f1nna-',        'NA_f1nna-'),  # alias diff menor, manter display_name
]

# 4. Subs: criar person + player_account (NAO entram no roster)
SUBS = [
    ('WIT_marcis',   'WIT_marcis',   'account.465e8f99195d485e971dd66361775e46'),
    ('CLR_MIKSUU-',  'CLR_MIKSUU-',  'account.1e003176db304fdd917e32fa7e799a44'),
    ('INJ_Plushiee', 'INJ_Plushiee', 'account.c5582e0b2a8b465cbec918d097b19530'),
    ('FR_gats',      'FR_gats',      'account.af48a219b3f747cea9f713b3a9cb8a5b'),
]

with engine.begin() as conn:

    # ── 1. Pending/NULL ──────────────────────────────────────────────────────
    print('=== 1. Atualizando contas PENDING/NULL ===')
    for disp, old_alias, new_acc, new_alias, new_disp in UPDATES_PENDING:
        pid = conn.execute(text('SELECT id FROM person WHERE display_name=:d'), {'d': disp}).scalar()
        if not pid:
            print(f'  ERRO: person nao encontrado para {disp!r}')
            continue

        if old_alias is None:
            res = conn.execute(text(
                'UPDATE player_account SET account_id=:a, alias=:al '
                'WHERE person_id=:p AND (account_id IS NULL OR account_id LIKE :pend)'
            ), {'a': new_acc, 'al': new_alias, 'p': pid, 'pend': 'pending_%'})
        else:
            res = conn.execute(text(
                'UPDATE player_account SET account_id=:a, alias=:al '
                'WHERE person_id=:p AND (account_id LIKE :pend OR alias=:old)'
            ), {'a': new_acc, 'al': new_alias, 'p': pid, 'pend': 'pending_%', 'old': old_alias})

        if new_disp and new_disp != disp:
            conn.execute(text('UPDATE person SET display_name=:n WHERE id=:p'), {'n': new_disp, 'p': pid})
            disp_info = f' | display_name: {disp} -> {new_disp}'
        else:
            disp_info = ''

        print(f'  {disp:<20} -> {new_acc}  ({res.rowcount} pa rows){disp_info}')

    # ── 2. Contas erradas ────────────────────────────────────────────────────
    print()
    print('=== 2. Substituindo contas erradas ===')
    for disp, old_acc, new_acc, new_alias, new_disp in UPDATES_WRONG:
        pid = conn.execute(text('SELECT id FROM person WHERE display_name=:d'), {'d': disp}).scalar()
        if not pid:
            print(f'  ERRO: person nao encontrado para {disp!r}')
            continue

        res1 = conn.execute(text(
            'UPDATE player_account SET active_until=:now '
            'WHERE person_id=:p AND account_id=:a AND active_until IS NULL'
        ), {'now': NOW, 'p': pid, 'a': old_acc})

        conn.execute(text(
            'INSERT INTO player_account (person_id, alias, account_id, shard) VALUES (:p, :al, :a, :s)'
        ), {'p': pid, 'al': new_alias, 'a': new_acc, 's': 'pc-tournament'})

        if new_disp and new_disp != disp:
            conn.execute(text('UPDATE person SET display_name=:n WHERE id=:p'), {'n': new_disp, 'p': pid})
            disp_info = f' | display_name: {disp} -> {new_disp}'
        else:
            disp_info = ''

        print(f'  {disp:<20} desativou {res1.rowcount} antiga(s) + inseriu {new_acc}{disp_info}')

    # ── 3. Display names sem mudanca de conta ───────────────────────────────
    print()
    print('=== 3. Atualizando display_names (conta ja correta) ===')
    for old_dn, new_dn in DISPLAY_NAME_ONLY:
        if old_dn == new_dn:
            continue
        res = conn.execute(text('UPDATE person SET display_name=:n WHERE display_name=:o'), {'n': new_dn, 'o': old_dn})
        print(f'  {old_dn:<25} -> {new_dn}  ({res.rowcount} rows)')

    # ── 4. Subs ──────────────────────────────────────────────────────────────
    print()
    print('=== 4. Criando subs ===')
    for disp, alias, acc in SUBS:
        existing = conn.execute(text('SELECT id FROM person WHERE display_name=:d'), {'d': disp}).scalar()
        if existing:
            print(f'  {disp} ja existe (id={existing}), pulando')
            continue
        new_pid = conn.execute(text(
            'INSERT INTO person (display_name) VALUES (:d) RETURNING id'
        ), {'d': disp}).scalar()
        conn.execute(text(
            'INSERT INTO player_account (person_id, alias, account_id, shard) VALUES (:p, :al, :a, :s)'
        ), {'p': new_pid, 'al': alias, 'a': acc, 's': 'pc-tournament'})
        print(f'  Criado: {disp} (id={new_pid}) -> {acc}')

print()
print('Concluido!')
