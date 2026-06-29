-- Non-unique helper index on the canonical pair, ready for future uniqueness.
CREATE INDEX IF NOT EXISTS friends_pair_idx
  ON public.friends (LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2));

COMMENT ON INDEX public.friends_pair_idx IS
  'Pair index for friends. To enforce no-duplicate Connections post-Apple-review, run:
   DROP INDEX public.friends_pair_idx;
   CREATE UNIQUE INDEX friends_unique_pair_idx ON public.friends (LEAST(user_id_1,user_id_2), GREATEST(user_id_1,user_id_2));';