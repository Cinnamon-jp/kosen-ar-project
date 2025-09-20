### 環境構築
```bash
# 仮想環境の作成・起動
> python -m venv .venv
> .venv/Scripts/activate

(.venv) > pip install labelImg
(.venv) > cd labelimg-master

# リソースファイルのコンパイル
(.venv) labelimg-master> python -m PyQt5.pyrcc_main resources.qrc -o libs/resources.py
```

### labelImgの起動
```bash
# 仮想環境の起動
> .venv/Scripts/activate

(.venv) > cd labelimg-master
(.venv) labelimg-master> python labelImg.py
```