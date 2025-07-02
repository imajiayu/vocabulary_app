# -*- coding: utf-8 -*-
import random
from flask import Flask, flash, render_template, redirect, url_for, request, session, jsonify
from web_app.const import MODE_LAPSE, MODE_NEW, MODE_REVIEW, MODE_SPELLING
from web_app.utils.db_tools import (
    fetch_word_by_id,
    fill_definitions,
    insert_new_word,
)
from web_app.utils.definition_tools import extract_definition
from web_app.utils.fetch_words import fetch_word_ids
from web_app.utils.update_words import (
    update_word_info_lapse,
    update_word_info_new,
    update_word_info_review,
)
from web_app.utils.db_tools import get_db, close_db

app = Flask(__name__)
app.teardown_appcontext(close_db)
app.secret_key = "your-secret-key"  # 用于 session

@app.route('/favicon.ico')
def favicon():
    return '', 204  # 204 No Content

# 路由：首页，选择复习模式
@app.route("/")
def index():
    count_new = len(fetch_word_ids(MODE_NEW)) // 2
    count_review = len(fetch_word_ids(MODE_REVIEW))
    count_lapse = len(fetch_word_ids(MODE_LAPSE))
    return render_template(
        "index.html",
        count_new=count_new,
        count_review=count_review,
        count_lapse=count_lapse,
    )

# 路由：插入单词页面
@app.route("/insert", methods=["GET", "POST"])
def insert_page():
    if request.method == "POST":
        # 处理表单提交
        word = request.form["word"].strip().lower()
        if word:
            if not insert_new_word(word):
                flash(f"单词 '{word}' 已存在！", "error")  # 仅失败时提示
        return redirect(url_for("insert_page"))
    
    # GET 请求，渲染页面
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, word, stop_review, ease_factor FROM IELTS ORDER BY word ASC")
    words = cursor.fetchall()
    return render_template("insert.html", words=words)



@app.route("/update_stop_review", methods=["POST"])
def update_stop_review():
    data = request.get_json()
    word_id = data.get("id")
    stop_review = data.get("stop_review")
    db = get_db()
    db.execute("UPDATE IELTS SET stop_review = ? WHERE id = ?", (stop_review, word_id))
    db.commit()
    return jsonify(success=True)


@app.route("/set_filters", methods=["POST"])
def set_filters():
    session["mode"] = request.form.get("mode", "all")
    session["shuffle"] = request.form.get("shuffle", "true")
    session.pop("word_id_list", None)
    session.pop("spelling_word_id_list", None)

    fill_definitions()
    if session["mode"] == MODE_SPELLING:
        return redirect(url_for("spelling"))
    return redirect(url_for("review"))


@app.route("/review", methods=["GET"])
def review():
    index = int(request.args.get("index", 0))
    mode = session.get("mode", MODE_REVIEW)
    shuffle = session.get("shuffle", "true") == "true"

    if "word_id_list" not in session:
        word_id_list = fetch_word_ids(mode, shuffle)
        session["word_id_list"] = word_id_list
    else:
        word_id_list = session["word_id_list"]

    if mode == MODE_LAPSE:
        if len(word_id_list) > 0:
            if index % len(word_id_list) == 0:
                random.shuffle(word_id_list)
                session["word_id_list"] = word_id_list
            word = fetch_word_by_id(word_id_list[index % len(word_id_list)])
        else:
            word = None
    else:
        word = (
            fetch_word_by_id(word_id_list[index]) if index < len(word_id_list) else None
        )
    return render_template(
        "review.html",
        word=word,
        index=0 if len(word_id_list) == 0 else index % len(word_id_list),
        total=len(word_id_list),
    )


@app.route("/update/<int:word_id>", methods=["POST"])
def update(word_id):
    remembered = request.form["remembered"] == "yes"
    elapsed_time = int(request.form.get("elapsed_time", 0))

    mode = session.get("mode", MODE_REVIEW)

    if mode == MODE_NEW:
        update_word_info_new(word_id, remembered, elapsed_time)
    elif mode == MODE_REVIEW:
        update_word_info_review(word_id, remembered, elapsed_time)
    elif mode == MODE_LAPSE:
        update_word_info_lapse(word_id, remembered)

    return '', 200

@app.route("/stop_review/<int:word_id>", methods=["POST"])
def stop_review(word_id):
    index = int(request.args.get("index", 0))
    db = get_db()
    db.execute("UPDATE IELTS SET stop_review = 1 WHERE id = ?", (word_id,))
    db.commit()
    return '', 200


@app.route("/spelling", methods=["GET"])
def spelling():
    index = int(request.args.get("index", 0))
    if "spelling_word_id_list" not in session:
        spelling_word_id_list = fetch_word_ids(mode=MODE_SPELLING)
        session["spelling_word_id_list"] = spelling_word_id_list
    else:
        spelling_word_id_list = session["spelling_word_id_list"]
    word = (
        fetch_word_by_id(spelling_word_id_list[index])
        if index < len(spelling_word_id_list)
        else None
    )
    if word:
        word["definition"] = extract_definition(word.get("definition", ""))
    return render_template(
        "spelling.html", word=word, index=index, total=len(spelling_word_id_list)
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, use_reloader=True)
