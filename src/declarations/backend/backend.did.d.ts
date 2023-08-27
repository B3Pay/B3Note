import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface EncryptedText {
  'time_lock' : bigint,
  'public_key' : Uint8Array | number[],
  'plain_text' : string,
}
export type Result = { 'Ok' : string } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : boolean } |
  { 'Err' : string };
export interface _SERVICE {
  'decrypt_text' : ActorMethod<[string, string], Result>,
  'encrypted_ibe_decryption_key_for_caller' : ActorMethod<
    [Uint8Array | number[], Uint8Array | number[]],
    string
  >,
  'encrypted_symmetric_key_for_caller' : ActorMethod<
    [Uint8Array | number[]],
    string
  >,
  'get_encrypted_text' : ActorMethod<[Uint8Array | number[], bigint], string>,
  'get_encrypted_texts' : ActorMethod<[], Array<[bigint, EncryptedText]>>,
  'ibe_encryption_key' : ActorMethod<[], string>,
  'read_encrypted_text' : ActorMethod<[bigint], string>,
  'save_encrypted_text' : ActorMethod<[EncryptedText], undefined>,
  'symmetric_key_verification_key' : ActorMethod<[], string>,
  'symmetric_key_verification_key_for' : ActorMethod<
    [[] | [Principal]],
    string
  >,
  'verify_caller' : ActorMethod<[string, string, string], Result_1>,
  'verify_ownership_caller' : ActorMethod<[string, string, string], boolean>,
  'verify_signature_with_encrypted_key_caller' : ActorMethod<
    [string, string],
    boolean
  >,
}
