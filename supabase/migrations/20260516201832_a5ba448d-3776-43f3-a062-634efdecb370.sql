DELETE FROM public.committee_applications
 WHERE aca_payload->>'hardware_attestation_id' LIKE 'DEV_TOUCHPOINT_SIMULATION_%';

DELETE FROM public.dao_vetoes
 WHERE aca_payload->>'hardware_attestation_id' LIKE 'DEV_TOUCHPOINT_SIMULATION_%';

DELETE FROM public.dao_votes
 WHERE aca_payload->>'hardware_attestation_id' LIKE 'DEV_TOUCHPOINT_SIMULATION_%';