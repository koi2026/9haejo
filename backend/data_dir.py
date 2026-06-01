"""
DATA_DIR: 영속 데이터 경로 설정
Railway Volume 마운트 시 DATA_DIR=/data 환경변수 설정
개발 환경에서는 backend/ 폴더 사용
"""
import os
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent))
DATA_DIR.mkdir(parents=True, exist_ok=True)
