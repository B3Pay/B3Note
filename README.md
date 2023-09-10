# B3Note: An Anonymous, Decentralized Note-Sharing Platform

## Introduction

B3Note is a decentralized platform built on the Internet Computer that allows you to create and share notes. With strong encryption and blockchain-based verification, B3Note emphasizes privacy and security. The platform offers two distinct features: anonymous note sharing and authenticated note sharing.

**Frontend Link**: [B3Note on IC](https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io/)

## Technologies Used

- Rust
- Internet Computer
- BLS Pairing for Blockchain Verification
- VetKeys API
- Symmetric Key Encryption
- Custom Rust crate: `b3_utils`

## Setup and Installation

1. Clone the repository

   ```bash
   git clone https://github.com/B3Pay/b3-note.git
   ```

2. Navigate to the project directory
   ```bash
   cd B3Note
   ```
3. Install dependencies
   ```bash
   yarn dfx:start
   ```
4. Run the application
   ```bash
   yarn deploy
   ```
5. For development mode:
   ```bash
   yarn dev
   ```

## Usage

### Anonymous Note Sharing:

1. Open the application go to the 'Without Identity
   ' tab
   and select 'Random Login'.
2. Write your note and click 'Save'.
3. Open the Note and click 'Generate Link'. Share this link to give read access to the note.
4. The link is valid for one hour and will be deleted after the first access.

### Authenticated Note Sharing:

1. Open the application and go to the 'With Identity' tab.
2. Login with your Internet Computer identity.
3. Write your note and click 'Save'.
4. Once logged in, create a note.
5. Similar to anonymous notes, a shareable link will be generated.
6. This link can be verified on the blockchain using BLS pairing.

## Features

- **Anonymous Note Sharing**: Create and share notes without login.
- **Authenticated Note Sharing**: Enhanced security through blockchain verification.
- **Time-Limited Links**: Links expire after one hour or after the first access.
- **Blockchain Verification**: Utilizes BLS pairing for note verification.
- **Strong Encryption**: Notes are encrypted using symmetric key encryption and VetKeys API.
- **Utility Crate**: `b3_utils` makes it easy to use various Internet Computer features like stable memory, timers, and logging.

## License

This project is open-source, licensed under MIT.
