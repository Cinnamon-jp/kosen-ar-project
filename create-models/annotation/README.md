### 環境構築
#### labelImgのインストール
1. > https://github.com/HumanSignal/labelImg
からlabelImgプロジェクトをダウンロード（ [<> Code ▼] -> Download ZIP）
2. ダウンロードしたzipファイルを展開し、内側の`labelImg-master`をルートディレクトリに配置（**※二重ディレクトリに注意**）

```bash
# 仮想環境の作成・起動
> python -m venv .venv
> .venv/Scripts/activate

(.venv) > pip install labelImg
(.venv) > cd labelImg-master

# リソースファイルのコンパイル
(.venv) labelimg-master> python -m PyQt5.pyrcc_main resources.qrc -o libs/resources.py
```

### labelImgの起動
```bash
# 仮想環境の起動
> .venv/Scripts/activate

(.venv) > cd labelImg-master
(.venv) labelimg-master> python labelImg.py
```