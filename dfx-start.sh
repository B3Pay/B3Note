if [[ $* == *--use-old-metering* ]]; then
    dfx start --use-old-metering --clean --background
else
    dfx start --clean --background
fi

dfx deploy system_api --specified-id wfdtj-lyaaa-aaaap-abakq-cai

cd ic-vetkd-utils && wasm-pack build --release && wasm-pack pack && cd ..

cd ./frontend && yarn install && cd ..