-- SEC-008: the sessions bucket took any kind of file up to 50 MB. It only
-- ever holds a node's four files (JSON, CSV and the binary curves), none of
-- them near 8 MB (the most one file may declare inside an uploaded zip).
update storage.buckets
   set allowed_mime_types = array['application/json', 'text/csv', 'application/octet-stream'],
       file_size_limit    = 8388608
 where id = 'sessions';
