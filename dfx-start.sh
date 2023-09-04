if [[ $* == *--enable-bitcoin* ]]; then
    dfx start --enable-bitcoin --clean --background
else
    dfx start --clean --background
fi

dfx deploy system_api --specified-id wfdtj-lyaaa-aaaap-abakq-cai

cd ./frontend && yarn install && cd ..