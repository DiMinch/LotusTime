const db = require('./src/db/pool');

const mapping = {
  'L01': ['Jasmine', 'Mark', 'Nana', 'Mia'],
  'L02': ['Kim Quyên', 'Nana'],
  'L03': ['Kim Quyên', 'Nasa', 'Nana'],
  'L04': ['Nana', 'Jasmine'],
  'L05': ['Nana', 'Anna', 'Thúy Quyên'],
  'L06': ['Grace', 'Yelena', 'Nana'],
  'L07': ['Jasmine', 'Mikey', 'Yelena'],
  'L08': ['Nasa', 'Mark', 'Kim Quyên', 'Vincent', 'Jasmine'],
  'L09': ['Jasmine', 'Millie', 'Mikey', 'Mark', 'Nya', 'Kim Quyên'],
  'L10': ['Nhàn', 'Kyelie', 'Nana'],
  'L11': ['Nhàn', 'Anna'],
  'L12': ['Mark', 'Nya', 'Kim Quyên', 'Mikey', 'Mia'],
  'L14': ['Jasmine', 'Nasa', 'Mikey'],
  'L15': ['Grace', 'Kim Quyên', 'Yelena', 'Nana', 'Mark'],
  'L16': ['Thúy Quyên', 'Nana'],
  'L17': ['Nana', 'Jasmine'],
  'L18': ['Thúy Quyên', 'Mikey'],
  'L19': ['Nhàn', 'Kyelie', 'Nana'],
  'L20': ['Mark', 'Mia', 'Kim Quyên', 'Millie'],
  'L21': ['Kim Quyên', 'Mark', 'Vincent', 'Grace'],
  'L22': ['Thúy Quyên', 'Nana'],
  'L23': ['Nhàn', 'Anna', 'Nana'],
};

async function main() {
  const { rows: persons } = await db.query('SELECT id, short_name FROM persons');
  const personMap = {};
  for (const p of persons) {
    personMap[p.short_name] = p.id;
  }

  const { rows: classes } = await db.query('SELECT id, code FROM classes');
  const classMap = {};
  for (const c of classes) {
    classMap[c.code] = c.id;
  }

  await db.query('DELETE FROM person_class_permissions');

  let count = 0;
  for (const [code, names] of Object.entries(mapping)) {
    const classId = classMap[code];
    if (!classId) {
      console.log(`Class ${code} not found in DB`);
      continue;
    }

    for (const name of names) {
      const personId = personMap[name];
      if (!personId) {
        console.log(`Person ${name} not found in DB`);
        continue;
      }

      await db.query(
        `INSERT INTO person_class_permissions (class_id, person_id, allowed_roles) VALUES ($1, $2, $3)`,
        [classId, personId, ['any']]
      );
      count++;
    }
  }

  console.log(`Seeded ${count} permissions successfully!`);
}

main().catch(console.error).finally(() => process.exit(0));
