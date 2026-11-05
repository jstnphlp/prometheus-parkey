-- Keep database exports byte-compatible with the original NCR publication
-- contentHash format. Requests must use compact recursively ordered JSON.
begin;
create function parkey_private.canonical_review_json(value jsonb)
returns text language plpgsql immutable set search_path = '' set extra_float_digits = 1 as $$
declare result text; number_value double precision; number_text text;
begin
  if jsonb_typeof(value) = 'object' then
    select '{' || coalesce(string_agg(to_jsonb(k)::text || ':' || parkey_private.canonical_review_json(v), ',' order by k collate "C"),'') || '}'
      into result from jsonb_each(value) item(k,v);
  elsif jsonb_typeof(value) = 'array' then
    select '[' || coalesce(string_agg(parkey_private.canonical_review_json(v), ',' order by n),'') || ']'
      into result from jsonb_array_elements(value) with ordinality item(v,n);
  elsif jsonb_typeof(value) = 'number' then
    -- JSONB retains decimal trailing zeros; JavaScript JSON.stringify does not.
    -- Use the float's shortest round-trip text, with ECMAScript's fixed/scientific
    -- thresholds and exponent spelling. This also rejects overprecision when
    -- the trigger compares supplied bytes with their canonical representation.
    number_value := (value #>> '{}')::double precision;
    number_text := number_value::text;
    if number_value = 0 then result := '0';
    elsif abs(number_value) >= 0.000001 and abs(number_value) < 1e21 then
      result := trim_scale(number_text::numeric)::text;
    else result := regexp_replace(number_text, 'e([+-])0+([0-9]+)$', 'e\1\2');
    end if;
  else result := value::text;
  end if;
  return result;
end;
$$;
revoke all on function parkey_private.canonical_review_json(jsonb) from public, anon, authenticated, service_role;

create function parkey_private.validate_review_event_encoding()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.event_text is distinct from parkey_private.canonical_review_json(new.event_text::jsonb) then
    raise exception 'Use canonical publication event encoding';
  end if;
  return new;
end;
$$;
revoke all on function parkey_private.validate_review_event_encoding() from public, anon, authenticated, service_role;
create trigger canonical_discovery_decision before insert on parkey_private.discovery_evidence_decisions
  for each row execute function parkey_private.validate_review_event_encoding();
commit;
