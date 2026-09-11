-- Équipe fictive demandée pour tester renforts et officiels.
-- Ajout unique : aucun match ni joueur existant n'est remplacé.
UPDATE club_state
SET payload = json_set(
  payload,
  '$.teams', json_insert(json_extract(payload, '$.teams'), '$[#]', json('{"id":"test-lynx-corpo","name":"Les Lynx — test","short":"LYNX","color":"#b79bf2"}')),
  '$.players', json_insert(json_extract(payload, '$.players'),
    '$[#]', json('{"id":"test-lynx-corpo-01","name":"Alex Garnier","number":4,"teamId":"test-lynx-corpo","license":"never","limited":false,"cap":null}'),
    '$[#]', json('{"id":"test-lynx-corpo-02","name":"Camille Lemaire","number":5,"teamId":"test-lynx-corpo","license":"former","limited":false,"cap":null}'),
    '$[#]', json('{"id":"test-lynx-corpo-03","name":"Sam Robin","number":6,"teamId":"test-lynx-corpo","license":"current","limited":true,"cap":12}'),
    '$[#]', json('{"id":"test-lynx-corpo-04","name":"Charlie Perrin","number":7,"teamId":"test-lynx-corpo","license":"never","limited":false,"cap":null}'),
    '$[#]', json('{"id":"test-lynx-corpo-05","name":"Sacha Morel","number":8,"teamId":"test-lynx-corpo","license":"former","limited":false,"cap":null}'),
    '$[#]', json('{"id":"test-lynx-corpo-06","name":"Lou André","number":9,"teamId":"test-lynx-corpo","license":"current","limited":false,"cap":null}'),
    '$[#]', json('{"id":"test-lynx-corpo-07","name":"Noa Rousseau","number":10,"teamId":"test-lynx-corpo","license":"never","limited":false,"cap":null}'),
    '$[#]', json('{"id":"test-lynx-corpo-08","name":"Max Clément","number":11,"teamId":"test-lynx-corpo","license":"never","limited":false,"cap":null}')
  )
), revision = revision + 1, mutation_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'club'
  AND NOT EXISTS (
    SELECT 1 FROM json_each(json_extract(club_state.payload, '$.teams'))
    WHERE json_extract(value, '$.id') = 'test-lynx-corpo'
  );
