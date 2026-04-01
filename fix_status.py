import psycopg2, os
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute("UPDATE tournaments SET status = 'finished' WHERE id IN (12, 13, 14)")
conn.commit()
print('Atualizado:', cur.rowcount, 'torneios')
conn.close()
