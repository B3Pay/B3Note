if [[ $* == *--enable-bitcoin* ]]; then
    dfx start --enable-bitcoin --clean
else
    dfx start --clean
fi

dfx deploy system_api --specified-id wfdtj-lyaaa-aaaap-abakq-cai